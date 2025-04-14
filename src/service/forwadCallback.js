import axios from "axios";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import { activeTask, decrementActiveTask, incrementActiveTask, serverIsClosing } from "../index.js";
import Client from "../models/clientModel.js";
import FailedCallback from "../models/failedForwardModel.js";
import Order from "../models/orderModel.js";
import { validateCallback, validatePaymentVASNAP, validateSnapDelete } from "../validators/paymentValidator.js";
import { generateHeadersForward, generateRequestId } from "./paylabs.js";

export const forwardCallback = async ({ payload, retryCount = 0 }) => {
    const retryIntervals = [5, 15, 30, 60, 300, 900, 1800];

    const logFailedCallback = async (payload, callbackUrl, retryCount, errDesc, clientId, delay) => {
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
        ).catch((err) => logger.error(`Failed to log callback: ${err.message}`));
    };

    const validateResponse = async (response) => {
        const {
            "content-type": contentType,
            "x-timestamp": timestamp,
            "x-signature": signature,
            "x-request-id": requestId,
        } = response.headers;

        if (!contentType?.toLowerCase().includes("application/json")) {
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
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        const paymentId = payload.merchantTradeNo?.trim();
        if (!paymentId) throw new ResponseError(400, "Invalid transaction ID");

        const order = await Order.findOne({ paymentId });
        if (!order) throw new ResponseError(404, `Order not found for ID: ${paymentId}`);

        const client = await Client.findOne({ clientId: order.clientId }).select("+clientId");
        if (!client || !client.notifyUrl) throw new ResponseError(400, "Missing callback URL");

        const callbackUrl = client.notifyUrl;
        const parsedUrl = new URL(callbackUrl);
        const path = parsedUrl.pathname;

        const attemptCallback = async (retryAttempt) => {
            try {
                if (serverIsClosing) {
                    logger.warn("Server shutting down. Aborting retries.");
                    await logFailedCallback(payload, callbackUrl, retryAttempt, "Server shutting down.", client._id, 0);
                    return;
                }

                const { headers: responseHeaders } = generateHeadersForward("POST", path, payload, generateRequestId());

                const response = await axios.post(callbackUrl, payload, {
                    headers: responseHeaders,
                    timeout: 10000,
                });

                await validateResponse(response);
                logger.info(`Callback successfully forwarded on attempt ${retryAttempt + 1}`);

                await logCallback({
                    type: "outcoming",
                    source: "internal",
                    target: "client",
                    status: "success",
                    payload,
                    response: response,
                    requestId: response.data.requestId,
                });
            } catch (err) {
                logger.error(`Attempt ${retryAttempt + 1} failed: ${err.message}`);
                logger.error(`Stack Trace: ${err.stack}`);

                if (retryAttempt < retryIntervals.length) {
                    const delay = retryIntervals[retryAttempt];

                    await logFailedCallback(payload, callbackUrl, retryAttempt, err.message, client._id, delay);
                    logger.info(`Retrying in ${delay} seconds...`);

                    setTimeout(() => attemptCallback(retryAttempt + 1), delay * 1000);
                } else {
                    logger.error("Exhausted retries.");
                    await logFailedCallback(payload, callbackUrl, retryAttempt, err.message, client._id, 0);
                    sendAlert(`Failed to forward callback after ${retryAttempt + 1} attempts: ${err.message}`);
                }
            }
        };

        await attemptCallback(retryCount);
    } catch (error) {
        logger.error(`Critical error in forwardCallback: ${error.message}`);
        logger.error(error.stack);
        throw error;
    } finally {
        decrementActiveTask();
        logger.info(`Task completed. Active tasks: ${activeTask}`);
    }
};

export const forwardCallbackSnap = async ({ payload, retryCount = 0 }) => {
    const retryIntervals = [5, 15, 30, 60, 300, 900, 1800];

    const logFailedCallback = async (payload, callbackUrl, retryCount, errDesc, clientId, delay) => {
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
        ).catch((err) => logger.error(`Failed to log callback: ${err.message}`));
    };

    const validateResponse = async (response) => {
        const {
            "content-type": contentType,
            "x-timestamp": timestamp,
            "x-signature": signature,
            "x-request-id": requestId,
        } = response.headers;

        if (!contentType || !contentType.toLowerCase().includes("application/json")) {
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
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
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
        if (!client || !client.notifyUrl) throw new ResponseError(400, "Missing callback URL");

        const callbackUrl = client.notifyUrl;
        const parsedUrl = new URL(callbackUrl);
        const path = parsedUrl.pathname;

        const attemptCallback = async (retryAttempt) => {
            try {
                if (serverIsClosing) {
                    logger.warn("Server shutting down. Aborting retries.");
                    await logFailedCallback(payload, callbackUrl, retryAttempt, "Server shutting down.", client._id, 0);
                    return;
                }

                const { headers: responseHeaders } = generateHeadersForward("POST", path, payload, generateRequestId());

                const response = await axios.post(callbackUrl, payload, {
                    headers: responseHeaders,
                    timeout: 10000,
                });

                await validateResponse(response);
                logger.info(`Callback successfully forwarded on attempt ${retryAttempt + 1}`);

                await logCallback({
                    type: "outcoming",
                    source: "internal",
                    target: "client",
                    status: "success",
                    payload,
                    response: response,
                    requestId: response.data.requestId,
                });
            } catch (err) {
                logger.error(`Attempt ${retryAttempt + 1} failed: ${err.message}`);
                logger.error(`Stack Trace: ${err.stack}`);

                if (retryAttempt < retryIntervals.length) {
                    const delay = retryIntervals[retryAttempt];

                    await logFailedCallback(payload, callbackUrl, retryAttempt, err.message, client._id, delay);
                    logger.info(`Retrying in ${delay} seconds...`);

                    setTimeout(() => attemptCallback(retryAttempt + 1), delay * 1000);
                } else {
                    logger.error("Exhausted retries.");
                    await logFailedCallback(payload, callbackUrl, retryAttempt, err.message, client._id, 0);
                    sendAlert(`Failed to forward callback after ${retryAttempt + 1} attempts: ${err.message}`);
                }
            }
        };

        await attemptCallback(retryCount);
    } catch (error) {
        logger.error(`Critical error in forwardCallback: ${error.message}`);
        logger.error(error.stack);
        throw error;
    } finally {
        decrementActiveTask();
        logger.info(`Task completed. Active tasks: ${activeTask}`);
    }
};

export const forwardCallbackSnapDelete = async ({ payload, retryCount = 0 }) => {
    const retryIntervals = [5, 15, 30, 60, 300, 900, 1800];

    const logFailedCallback = async (payload, callbackUrl, retryCount, errDesc, clientId, delay) => {
        logger.error(`Logging failed callback attempt ${retryCount}: ${JSON.stringify(payload)}`);
        const merchantTradeNo = String(payload.virtualAccountData.trxId);

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
        ).catch((err) => logger.error(`Failed to log callback: ${err.message}`));
    };

    const validateResponse = async (response) => {
        const {
            "content-type": contentType,
            "x-timestamp": timestamp,
            "x-signature": signature,
            "x-request-id": requestId,
        } = response.headers;

        if (!contentType || !contentType.toLowerCase().includes("application/json")) {
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
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        const notificationData = payload;

        const trxId = notificationData.virtualAccountData.trxId;
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
        if (!client || !client.notifyUrl) throw new ResponseError(400, "Missing callback URL");

        const callbackUrl = client.notifyUrl;
        const parsedUrl = new URL(callbackUrl);
        const path = parsedUrl.pathname;

        const attemptCallback = async (retryAttempt) => {
            try {
                if (serverIsClosing) {
                    logger.warn("Server shutting down. Aborting retries.");
                    await logFailedCallback(
                        notificationData,
                        callbackUrl,
                        retryAttempt,
                        "Server shutting down.",
                        client._id,
                        0,
                    );
                    return;
                }

                const { headers: responseHeaders } = generateHeadersForward(
                    "POST",
                    path,
                    notificationData,
                    generateRequestId(),
                );

                const response = await axios.post(callbackUrl, notificationData, {
                    headers: responseHeaders,
                    timeout: 10000,
                });

                await validateResponse(response);
                logger.info(`Callback successfully forwarded on attempt ${retryAttempt + 1}`);

                await logCallback({
                    type: "outcoming",
                    source: "internal",
                    target: "client",
                    status: "success",
                    payload,
                    response: response,
                    requestId: response.data.requestId,
                });
            } catch (err) {
                logger.error(`Attempt ${retryAttempt + 1} failed: ${err.message}`);
                logger.error(`Stack Trace: ${err.stack}`);

                if (retryAttempt < retryIntervals.length) {
                    const delay = retryIntervals[retryAttempt];

                    await logFailedCallback(payload, callbackUrl, retryAttempt, err.message, client._id, delay);
                    logger.info(`Retrying in ${delay} seconds...`);

                    setTimeout(() => attemptCallback(retryAttempt + 1), delay * 1000);
                } else {
                    logger.error("Exhausted retries.");
                    await logFailedCallback(payload, callbackUrl, retryAttempt, err.message, client._id, 0);
                    sendAlert(`Failed to forward callback after ${retryAttempt + 1} attempts: ${err.message}`);
                }
            }
        };

        await attemptCallback(retryCount);
    } catch (error) {
        logger.error(`Critical error in forwardCallback: ${error.message}`);
        logger.error(error.stack);
        throw error;
    } finally {
        decrementActiveTask();
        logger.info(`Task completed. Active tasks: ${activeTask}`);
    }
};

const sendAlert = (message) => {
    logger.warn(`Alert: ${message}`);
    // Integrate with a third-party monitoring system here
};

export const retryCallbackById = async (callbackId) => {
    try {
        const failedCallback = await FailedCallback.findById(callbackId);

        if (!failedCallback) {
            logger.warn(`No failed callback found with ID: ${callbackId}`);
            throw new ResponseError(404, `No failed callback found with ID: ${callbackId}`);
        }

        logger.info(`Retrying failed callback with ID: ${callbackId}, Retry Count: ${failedCallback.retryCount}`);

        if (failedCallback.payload.virtualAccountData) {
            await forwardCallbackSnapDelete({
                payload: failedCallback.payload,
                retryCount: failedCallback.retryCount,
            });
        } else if (failedCallback.payload.trxId) {
            await forwardCallbackSnap({
                payload: failedCallback.payload,
                retryCount: failedCallback.retryCount,
            });
        } else {
            await forwardCallback({
                payload: failedCallback.payload,
                retryCount: failedCallback.retryCount,
            });
        }

        await failedCallback.deleteOne();
        logger.info(`Successfully retried and deleted callback with ID: ${callbackId}`);
    } catch (err) {
        logger.error(`Retry for callback ${callbackId} failed: ${err.message}`);
    }
};
