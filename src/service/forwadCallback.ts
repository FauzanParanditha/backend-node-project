import type { AxiosResponse } from "axios";
import axios from "axios";
import type { Types } from "mongoose";
import logger from "../application/logger.js";
import { activeTask, decrementActiveTask, incrementActiveTask, serverIsClosing } from "../application/serverState.js";
import { ResponseError } from "../error/responseError.js";
import Client from "../models/clientModel.js";
import FailedCallback from "../models/failedForwardModel.js";
import Order from "../models/orderModel.js";
import { logCallback } from "../utils/logCallback.js";
import { validateCallback, validatePaymentVASNAP, validateSnapDelete } from "../validators/paymentValidator.js";
import { logActivity } from "./activityLogService.js";
import { sendForceRetryAlert } from "./discordService.js";
import { generateHeadersForward, generateRequestId } from "./paylabs.js";

interface ForwardCallbackParams {
    payload: Record<string, unknown>;
    retryCount?: number;
    callbackId?: string;
}

const RETRY_INTERVALS = [5, 15, 30, 60, 300, 900, 1800] as const;
const MAX_RETRY = RETRY_INTERVALS.length;

const sendAlert = (message: string): void => {
    logger.warn(`Alert: ${message}`);
    // Integrate with a third-party monitoring system here
};

export const forwardCallback = async ({
    payload,
    retryCount = 0,
}: ForwardCallbackParams): Promise<boolean | undefined> => {
    const retryIntervals = RETRY_INTERVALS;

    const logFailedCallback = async (
        payload: Record<string, unknown>,
        callbackUrl: string,
        retryCount: number,
        errDesc: string,
        clientId: Types.ObjectId,
        delay: number,
    ): Promise<void> => {
        logger.error(`Logging failed callback attempt ${retryCount}: ${JSON.stringify(payload)}`);

        const merchantTradeNo = String(payload.merchantTradeNo);
        if (!/^PL-[a-f0-9]{16}$/.test(merchantTradeNo)) {
            throw new Error("Invalid merchantTradeNo format");
        }

        await FailedCallback.findOneAndUpdate(
            { "payload.merchantTradeNo": merchantTradeNo },
            {
                $set: {
                    payload,
                    callbackUrl,
                    retryCount,
                    errDesc,
                    clientId,
                    nextRetryAt: new Date(Date.now() + (delay ? delay * 1000 : 0)),
                    status: "pending",
                },
            },
            { upsert: true, new: true },
        ).catch((err: Error) => logger.error(`Failed to log callback: ${err.message}`));
    };

    const validateResponse = async (response: AxiosResponse): Promise<void> => {
        const {
            "content-type": contentType,
            "x-timestamp": timestamp,
            "x-signature": signature,
            "x-request-id": requestId,
        } = response.headers;

        if (!contentType || !String(contentType).toLowerCase().includes("application/json")) {
            throw new ResponseError(400, "Invalid Content-Type header");
        }
        if (!timestamp || !signature || !requestId) {
            throw new ResponseError(400, "Missing required headers");
        }

        const { requestId: bodyRequestId, errCode } = response.data;
        if (!bodyRequestId) throw new ResponseError(400, "Missing requestId in response body");
        if (errCode !== "0") throw new ResponseError(400, `Error code received: ${errCode}`);
    };

    incrementActiveTask();
    logger.info(`Active tasks: ${activeTask}`);

    try {
        logger.info(`Starting forwardCallback attempt ${retryCount + 1}`);

        const { error } = validateCallback(payload);
        if (error) {
            throw new ResponseError(400, error.details.map((err) => err.message).join(", "));
        }

        const paymentId = (payload.merchantTradeNo as string)?.trim();
        if (!paymentId) throw new ResponseError(400, "Invalid transaction ID");

        const order = await Order.findOne({ paymentId });
        if (!order) throw new ResponseError(404, `Order not found for ID: ${paymentId}`);

        const client = await Client.findOne({ clientId: order.clientId }).select("+clientId");
        if (!client || !client.notifyUrl) {
            logger.warn(`Callback skipped: client ${order.clientId} has no notifyUrl`);

            await logCallback({
                type: "outgoing",
                source: "system",
                target: "client",
                status: "skipped",
                clientId: client?._id as Types.ObjectId | undefined,
                payload,
                response: { message: "Client has no notifyUrl" },
                requestId: generateRequestId(),
            });

            return true; // dianggap selesai dengan sukses
        }

        const callbackUrl = client.notifyUrl;
        const parsedUrl = new URL(callbackUrl);
        const path = parsedUrl.pathname;

        const attemptCallback = async (retryAttempt: number): Promise<boolean | undefined> => {
            let requestHeaders: Record<string, unknown> | undefined;
            try {
                if (serverIsClosing) {
                    logger.warn("Server shutting down. Aborting retries.");
                    await logFailedCallback(
                        payload,
                        callbackUrl,
                        retryAttempt,
                        "Server shutting down.",
                        client._id as Types.ObjectId,
                        0,
                    );
                    return;
                }

                const { headers: responseHeaders } = generateHeadersForward(
                    "POST",
                    path,
                    payload,
                    generateRequestId(),
                    0,
                    client.clientId!,
                );
                requestHeaders = responseHeaders as Record<string, unknown>;

                const response = await axios.post(callbackUrl, payload, {
                    headers: responseHeaders as Record<string, string>,
                    timeout: 10000,
                });

                await validateResponse(response);
                logger.info(`Callback successfully forwarded on attempt ${retryAttempt + 1}`);

                await logCallback({
                    type: "outgoing",
                    source: "system",
                    target: "client",
                    status: "success",
                    clientId: client._id as Types.ObjectId,
                    payload: JSON.parse(JSON.stringify(payload)),
                    response: response.data,
                    statusCode: response.status,
                    requestHeaders,
                    responseHeaders: response.headers as Record<string, unknown>,
                    requestId: response.data.requestId,
                });
                return true;
            } catch (err: unknown) {
                const error = err as Error;
                const axiosErr = err as { response?: { status?: number; headers?: Record<string, unknown>; data?: Record<string, unknown> } };
                logger.error(`Attempt ${retryAttempt + 1} failed: ${error.message}`);
                logger.error(`Stack Trace: ${error.stack}`);

                if (retryAttempt < retryIntervals.length) {
                    const delay = retryIntervals[retryAttempt];

                    await logFailedCallback(
                        payload,
                        callbackUrl,
                        retryAttempt,
                        error.message,
                        client._id as Types.ObjectId,
                        delay,
                    );
                    logger.info(`Retrying in ${delay} seconds...`);

                    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
                    return await attemptCallback(retryAttempt + 1);
                } else {
                    logger.error("Exhausted retries.");
                    await logFailedCallback(
                        payload,
                        callbackUrl,
                        retryAttempt,
                        error.message,
                        client._id as Types.ObjectId,
                        0,
                    );
                    await logCallback({
                        type: "outgoing",
                        source: "system",
                        target: "client",
                        status: "failed",
                        clientId: client._id as Types.ObjectId,
                        payload: JSON.parse(JSON.stringify(payload)),
                        response: axiosErr.response?.data ?? null,
                        statusCode: axiosErr.response?.status,
                        requestHeaders,
                        responseHeaders: axiosErr.response?.headers ?? null,
                        errorMessage: error.message,
                    });
                    sendAlert(`Failed to forward callback after ${retryAttempt + 1} attempts: ${error.message}`);
                    throw error;
                }
            }
        };

        return await attemptCallback(retryCount);
    } catch (error: unknown) {
        const err = error as Error;
        logger.error(`Critical error in forwardCallback: ${err.message}`);
        logger.error(err.stack);
        throw error;
    } finally {
        decrementActiveTask();
        logger.info(`Task completed. Active tasks: ${activeTask}`);
    }
};

export const forwardCallbackSnap = async ({
    payload,
    retryCount = 0,
}: ForwardCallbackParams): Promise<boolean | undefined> => {
    const retryIntervals = RETRY_INTERVALS;

    const logFailedCallback = async (
        payload: Record<string, unknown>,
        callbackUrl: string,
        retryCount: number,
        errDesc: string,
        clientId: Types.ObjectId,
        delay: number,
    ): Promise<void> => {
        logger.error(`Logging failed callback attempt ${retryCount}: ${JSON.stringify(payload)}`);
        const merchantTradeNo = String(payload.trxId);

        // Validasi format merchantTradeNo
        if (!/^PL-[a-f0-9]{16}$/.test(merchantTradeNo)) {
            throw new Error("Invalid merchantTradeNo format");
        }

        await FailedCallback.findOneAndUpdate(
            { "payload.trxId": merchantTradeNo },
            {
                $set: {
                    payload,
                    callbackUrl,
                    retryCount,
                    errDesc,
                    clientId,
                    nextRetryAt: new Date(Date.now() + delay * 1000),
                    status: "pending",
                },
            },
            { upsert: true, new: true },
        ).catch((err: Error) => logger.error(`Failed to log callback: ${err.message}`));
    };

    const validateResponse = async (response: AxiosResponse): Promise<void> => {
        const {
            "content-type": contentType,
            "x-timestamp": timestamp,
            "x-signature": signature,
            "x-request-id": requestId,
        } = response.headers;

        if (!contentType || !String(contentType).toLowerCase().includes("application/json")) {
            throw new ResponseError(400, "Invalid Content-Type header");
        }
        if (!timestamp || !signature || !requestId) {
            throw new ResponseError(400, "Missing required headers");
        }

        const { requestId: bodyRequestId, errCode } = response.data;
        if (!bodyRequestId) throw new ResponseError(400, "Missing requestId in response body");
        if (errCode !== "0") throw new ResponseError(400, `Error code received: ${errCode}`);
    };

    incrementActiveTask();
    logger.info(`Active tasks: ${activeTask}`);

    try {
        logger.info(`Starting forwardCallback attempt ${retryCount + 1}`);

        const { error } = validatePaymentVASNAP(payload);
        if (error) {
            throw new ResponseError(400, error.details.map((err) => err.message).join(", "));
        }

        const notificationData = payload;

        const trxId = notificationData.trxId;
        if (typeof trxId !== "string" || trxId.trim() === "") {
            throw new ResponseError(400, "Invalid transaction ID");
        }

        const sanitizedTrxId = trxId.trim();
        const existOrder = await Order.findOne({ paymentId: sanitizedTrxId });
        if (!existOrder) {
            logger.error("Order not found for orderID: ", notificationData.trxId);
            throw new ResponseError(404, `Order not found for orderID: ${notificationData.trxId}`);
        }

        const client = await Client.findOne({ clientId: existOrder.clientId }).select("+clientId");
        if (!client || !client.notifyUrl) {
            logger.warn(`Callback skipped: client ${existOrder.clientId} has no notifyUrl`);

            await logCallback({
                type: "outgoing",
                source: "system",
                target: "client",
                status: "skipped",
                clientId: client?._id as Types.ObjectId | undefined,
                payload,
                response: { message: "Client has no notifyUrl" },
                requestId: generateRequestId(),
            });

            return true; // dianggap selesai dengan sukses
        }

        const callbackUrl = client.notifyUrl;
        const parsedUrl = new URL(callbackUrl);
        const path = parsedUrl.pathname;

        const attemptCallback = async (retryAttempt: number): Promise<boolean | undefined> => {
            let requestHeaders: Record<string, unknown> | undefined;
            try {
                if (serverIsClosing) {
                    logger.warn("Server shutting down. Aborting retries.");
                    await logFailedCallback(
                        payload,
                        callbackUrl,
                        retryAttempt,
                        "Server shutting down.",
                        client._id as Types.ObjectId,
                        0,
                    );
                    return;
                }

                const { headers: responseHeaders } = generateHeadersForward(
                    "POST",
                    path,
                    payload,
                    generateRequestId(),
                    0,
                    client.clientId!,
                );
                requestHeaders = responseHeaders as Record<string, unknown>;

                const response = await axios.post(callbackUrl, payload, {
                    headers: responseHeaders as Record<string, string>,
                    timeout: 10000,
                });

                await validateResponse(response);
                logger.info(`Callback successfully forwarded on attempt ${retryAttempt + 1}`);

                await logCallback({
                    type: "outgoing",
                    source: "system",
                    target: "client",
                    status: "success",
                    clientId: client._id as Types.ObjectId,
                    payload: JSON.parse(JSON.stringify(payload)),
                    response: response.data,
                    statusCode: response.status,
                    requestHeaders,
                    responseHeaders: response.headers as Record<string, unknown>,
                    requestId: response.data.requestId,
                });

                return true;
            } catch (err: unknown) {
                const error = err as Error;
                const axiosErr = err as { response?: { status?: number; headers?: Record<string, unknown>; data?: Record<string, unknown> } };
                logger.error(`Attempt ${retryAttempt + 1} failed: ${error.message}`);
                logger.error(`Stack Trace: ${error.stack}`);

                if (retryAttempt < retryIntervals.length) {
                    const delay = retryIntervals[retryAttempt];

                    await logFailedCallback(
                        payload,
                        callbackUrl,
                        retryAttempt,
                        error.message,
                        client._id as Types.ObjectId,
                        delay,
                    );
                    logger.info(`Retrying in ${delay} seconds...`);

                    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
                    return await attemptCallback(retryAttempt + 1);
                } else {
                    logger.error("Exhausted retries.");
                    await logFailedCallback(
                        payload,
                        callbackUrl,
                        retryAttempt,
                        error.message,
                        client._id as Types.ObjectId,
                        0,
                    );
                    await logCallback({
                        type: "outgoing",
                        source: "system",
                        target: "client",
                        status: "failed",
                        clientId: client._id as Types.ObjectId,
                        payload: JSON.parse(JSON.stringify(payload)),
                        response: axiosErr.response?.data ?? null,
                        statusCode: axiosErr.response?.status,
                        requestHeaders,
                        responseHeaders: axiosErr.response?.headers ?? null,
                        errorMessage: error.message,
                    });
                    sendAlert(`Failed to forward callback after ${retryAttempt + 1} attempts: ${error.message}`);
                    throw error;
                }

                return false;
            }
        };

        return await attemptCallback(retryCount);
    } catch (error: unknown) {
        const err = error as Error;
        logger.error(`Critical error in forwardCallback: ${err.message}`);
        logger.error(err.stack);
        throw error;
    } finally {
        decrementActiveTask();
        logger.info(`Task completed. Active tasks: ${activeTask}`);
    }
};

export const forwardCallbackSnapDelete = async ({
    payload,
    retryCount = 0,
}: ForwardCallbackParams): Promise<boolean | undefined> => {
    const retryIntervals = RETRY_INTERVALS;

    const logFailedCallback = async (
        payload: Record<string, unknown>,
        callbackUrl: string,
        retryCount: number,
        errDesc: string,
        clientId: Types.ObjectId,
        delay: number,
    ): Promise<void> => {
        logger.error(`Logging failed callback attempt ${retryCount}: ${JSON.stringify(payload)}`);
        const virtualAccountData = payload.virtualAccountData as Record<string, unknown>;
        const merchantTradeNo = String(virtualAccountData.trxId);

        // Validasi format merchantTradeNo
        if (!/^PL-[a-f0-9]{16}$/.test(merchantTradeNo)) {
            throw new Error("Invalid merchantTradeNo format");
        }

        await FailedCallback.findOneAndUpdate(
            { "payload.virtualAccountData.trxId": merchantTradeNo },
            {
                $set: {
                    payload,
                    callbackUrl,
                    retryCount,
                    errDesc,
                    clientId,
                    nextRetryAt: new Date(Date.now() + delay * 1000),
                    status: "pending",
                },
            },
            { upsert: true, new: true },
        ).catch((err: Error) => logger.error(`Failed to log callback: ${err.message}`));
    };

    const validateResponse = async (response: AxiosResponse): Promise<void> => {
        const {
            "content-type": contentType,
            "x-timestamp": timestamp,
            "x-signature": signature,
            "x-request-id": requestId,
        } = response.headers;

        if (!contentType || !String(contentType).toLowerCase().includes("application/json")) {
            throw new ResponseError(400, "Invalid Content-Type header");
        }
        if (!timestamp || !signature || !requestId) {
            throw new ResponseError(400, "Missing required headers");
        }

        const { clientId, requestId: bodyRequestId, errCode } = response.data;
        if (!clientId) throw new ResponseError(400, "Missing clientId in response body");

        const existingClientId = await Client.findOne({ clientId });
        if (!existingClientId) throw new ResponseError(404, "Client Id is not registered!");

        if (!bodyRequestId) throw new ResponseError(400, "Missing requestId in response body");

        if (errCode !== "0") throw new ResponseError(400, `Error code received: ${errCode}`);
    };

    incrementActiveTask();
    logger.info(`Active tasks: ${activeTask}`);

    try {
        logger.info(`Starting forwardCallback attempt ${retryCount + 1}`);

        const { error } = validateSnapDelete(payload);
        if (error) {
            throw new ResponseError(400, error.details.map((err) => err.message).join(", "));
        }

        const notificationData = payload;

        const virtualAccountData = notificationData.virtualAccountData as Record<string, unknown>;
        const trxId = virtualAccountData.trxId;
        if (typeof trxId !== "string" || trxId.trim() === "") {
            throw new ResponseError(400, "Invalid transaction ID");
        }

        const sanitizedTrxId = trxId.trim();
        const existOrder = await Order.findOne({ paymentId: sanitizedTrxId });
        if (!existOrder) {
            logger.error("Order not found for orderID: ", notificationData.trxId);
            throw new ResponseError(404, `Order not found for orderID: ${notificationData.trxId}`);
        }

        const client = await Client.findOne({ clientId: existOrder.clientId }).select("+clientId");
        if (!client || !client.notifyUrl) {
            logger.warn(`Callback skipped: client ${existOrder.clientId} has no notifyUrl`);

            await logCallback({
                type: "outgoing",
                source: "system",
                target: "client",
                status: "skipped",
                clientId: client?._id as Types.ObjectId | undefined,
                payload,
                response: { message: "Client has no notifyUrl" },
                requestId: generateRequestId(),
            });

            return true; // dianggap selesai dengan sukses
        }

        const callbackUrl = client.notifyUrl;
        const parsedUrl = new URL(callbackUrl);
        const path = parsedUrl.pathname;

        const attemptCallback = async (retryAttempt: number): Promise<boolean | void> => {
            let requestHeaders: Record<string, unknown> | undefined;
            try {
                if (serverIsClosing) {
                    logger.warn("Server shutting down. Aborting retries.");
                    await logFailedCallback(
                        notificationData,
                        callbackUrl,
                        retryAttempt,
                        "Server shutting down.",
                        client._id as Types.ObjectId,
                        0,
                    );
                    return;
                }

                const { headers: responseHeaders } = generateHeadersForward(
                    "POST",
                    path,
                    notificationData,
                    generateRequestId(),
                    0,
                    client.clientId!,
                );
                requestHeaders = responseHeaders as Record<string, unknown>;

                const response = await axios.post(callbackUrl, notificationData, {
                    headers: responseHeaders as Record<string, string>,
                    timeout: 10000,
                });

                await validateResponse(response);
                logger.info(`Callback successfully forwarded on attempt ${retryAttempt + 1}`);

                await logCallback({
                    type: "outgoing",
                    source: "system",
                    target: "client",
                    status: "success",
                    clientId: client._id as Types.ObjectId,
                    payload: JSON.parse(JSON.stringify(payload)),
                    response: response.data,
                    statusCode: response.status,
                    requestHeaders,
                    responseHeaders: response.headers as Record<string, unknown>,
                    requestId: response.data.requestId,
                });

                return;
            } catch (err: unknown) {
                const error = err as Error;
                const axiosErr = err as { response?: { status?: number; headers?: Record<string, unknown>; data?: Record<string, unknown> } };
                logger.error(`Attempt ${retryAttempt + 1} failed: ${error.message}`);
                logger.error(`Stack Trace: ${error.stack}`);

                if (retryAttempt < retryIntervals.length) {
                    const delay = retryIntervals[retryAttempt];

                    await logFailedCallback(
                        payload,
                        callbackUrl,
                        retryAttempt,
                        error.message,
                        client._id as Types.ObjectId,
                        delay,
                    );
                    logger.info(`Retrying in ${delay} seconds...`);

                    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
                    return await attemptCallback(retryAttempt + 1);
                } else {
                    logger.error("Exhausted retries.");
                    await logFailedCallback(
                        payload,
                        callbackUrl,
                        retryAttempt,
                        error.message,
                        client._id as Types.ObjectId,
                        0,
                    );
                    await logCallback({
                        type: "outgoing",
                        source: "system",
                        target: "client",
                        status: "failed",
                        clientId: client._id as Types.ObjectId,
                        payload: JSON.parse(JSON.stringify(payload)),
                        response: axiosErr.response?.data ?? null,
                        statusCode: axiosErr.response?.status,
                        requestHeaders,
                        responseHeaders: axiosErr.response?.headers ?? null,
                        errorMessage: error.message,
                    });
                    sendAlert(`Failed to forward callback after ${retryAttempt + 1} attempts: ${error.message}`);
                    throw error;
                }

                return false;
            }
        };

        return (await attemptCallback(retryCount)) as boolean | undefined;
    } catch (error: unknown) {
        const err = error as Error;
        logger.error(`Critical error in forwardCallback: ${err.message}`);
        logger.error(err.stack);
        throw error;
    } finally {
        decrementActiveTask();
        logger.info(`Task completed. Active tasks: ${activeTask}`);
    }
};

const markRetryFailed = async (callbackId: string, errDesc: string): Promise<void> => {
    await FailedCallback.updateOne({ _id: callbackId }, { $set: { status: "failed", errDesc } });
};

interface ForceRetryActor {
    actorId: string;
    role: "admin" | "finance" | "super_admin";
    email?: string;
    ipAddress?: string;
}

export const retryCallbackById = async (
    callbackId: string,
    force = false,
    actor?: ForceRetryActor,
): Promise<boolean> => {
    const update: Record<string, unknown> = { status: "processing" };
    if (force) {
        // Reset the counter so the next failure path has a full retry cycle
        // again. errDesc is intentionally preserved so the prior failure
        // context stays visible for investigation.
        update.retryCount = 0;
    }

    // new:false returns the previous document so we can capture pre-force state
    // for audit logging and Discord alerts before the counter gets reset.
    const failedCallback = await FailedCallback.findOneAndUpdate(
        { _id: callbackId, status: { $ne: "processing" } },
        { $set: update },
        { new: false },
    );

    if (!failedCallback) {
        throw new ResponseError(404, `Callback not found or already processing`);
    }

    if (!force && failedCallback.retryCount >= MAX_RETRY) {
        await FailedCallback.updateOne({ _id: callbackId }, { $set: { status: "dead" } });
        throw new ResponseError(410, "Max retry exceeded");
    }

    if (force && actor) {
        // Fire-and-forget audit + alert; failures here should not block the retry.
        logActivity({
            actorId: actor.actorId,
            role: actor.role,
            action: "FORCE_RETRY_CALLBACK",
            details: {
                callbackId,
                previousRetryCount: failedCallback.retryCount,
                previousStatus: failedCallback.status,
                previousErrDesc: failedCallback.errDesc ?? "",
            },
            ipAddress: actor.ipAddress,
        }).catch((e) => logger.error(`Failed to log force retry activity: ${e.message}`));

        sendForceRetryAlert(
            callbackId,
            actor.email ?? actor.actorId,
            failedCallback.retryCount,
            failedCallback.errDesc ?? "",
        ).catch((e) => logger.error(`Failed to send force retry Discord alert: ${e.message}`));
    }

    logger.debug("FAILED CALLBACK PAYLOAD:", failedCallback.payload);
    const payload = failedCallback.payload as Record<string, unknown>;
    let success: boolean | undefined = false;

    try {
        const virtualAccountData = payload.virtualAccountData as Record<string, unknown> | undefined;
        if (virtualAccountData) {
            success = await forwardCallbackSnapDelete({ payload, callbackId });
        } else if (payload.trxId) {
            success = await forwardCallbackSnap({ payload, callbackId });
        } else {
            success = await forwardCallback({ payload, callbackId });
        }

        if (success) {
            await failedCallback.deleteOne();
            logger.info(`✅ Callback ${callbackId} retried successfully`);
            return true;
        }

        await markRetryFailed(callbackId, "Callback returned false");
        return false;
    } catch (err: unknown) {
        const error = err as Error;
        logger.error(`❌ Retry error ${callbackId}: ${error.message}`);
        await markRetryFailed(callbackId, error.message);
        return false;
    }
};
