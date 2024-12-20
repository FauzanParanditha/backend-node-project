import axios from "axios";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import FailedCallback from "../models/failedForwardModel.js";
import Order from "../models/orderModel.js";
import Client from "../models/clientModel.js";
import { validateCallback } from "../validators/paymentValidator.js";
import { generateHeadersForward, generateRequestId, verifySignatureForward } from "./paylabs.js";
import { activeTask, decrementActiveTask, incrementActiveTask, serverIsClosing } from "../index.js";

export const forwardCallback = async ({ payload, retryCount = 0 }) => {
    const retryIntervals = [5, 15, 30, 60, 300, 900, 1800]; // Retry intervals in seconds

    const logFailedCallback = async (payload, callbackUrl, retryCount, errDesc) => {
        logger.error(`Logging failed callback: ${JSON.stringify(payload)}`);
        const failedCallback = new FailedCallback({
            payload,
            callbackUrl,
            retryCount,
            errDesc,
        });
        await failedCallback.save().catch((err) => logger.error(`Failed to log callback: ${err.message}`));
    };

    const validateResponse = async (response) => {
        const {
            "content-type": contentType,
            "x-timestamp": timestamp,
            "x-signature": signature,
            "x-request-id": requestId,
        } = response.headers;

        if (!contentType || contentType.toLowerCase() !== "application/json; charset=utf-8") {
            throw new ResponseError(400, "Invalid Content-Type header");
        }
        if (!timestamp || !signature || !requestId) {
            throw new ResponseError(400, "Missing required headers");
        }
        const { clientId, requestId: bodyRequestId, errCode } = response.data;
        if (!clientId) throw new ResponseError(400, "Missing clientId in response body");

        const existingClientId = await Client.findOne({ clientId });
        if (!existingClientId) throw new ResponseError(404, "Client Id is not registerd!");

        if (!bodyRequestId) throw new ResponseError(400, "Missing requestId in response body");

        if (errCode !== "0") throw new ResponseError(400, `Error code received: ${errCode}`);
    };

    incrementActiveTask();
    logger.info(`Active tasks: ${activeTask}`);

    try {
        logger.info(`Starting forwardCallback attempt ${retryCount + 1}`);

        const { error } = validateCallback(payload);
        if (error)
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );

        const notificationData = payload;
        const paymentId = notificationData.merchantTradeNo?.trim();
        if (!paymentId) throw new ResponseError(400, "Invalid transaction ID");

        const order = await Order.findOne({ paymentId });
        if (!order) throw new ResponseError(404, `Order not found for ID: ${paymentId}`);

        const client = await Client.findOne({ clientId: order.clientId });
        if (!client || !client.notifyUrl) throw new ResponseError(400, "Missing callback URL");

        const callbackUrl = client.notifyUrl;
        const parsedUrl = new URL(callbackUrl);
        const path = parsedUrl.pathname;

        while (retryCount < retryIntervals.length) {
            if (serverIsClosing) {
                logger.warn("Server shutting down. Aborting retries.");
                await logFailedCallback(payload, callbackUrl, retryCount, "Server shutting down. Aborting retries.");
                return; // Stop retries during shutdown
            }

            try {
                const { headers: responseHeaders } = generateHeadersForward(
                    "POST",
                    path,
                    notificationData,
                    generateRequestId(),
                );

                const response = await axios.post(callbackUrl, notificationData, {
                    headers: responseHeaders,
                });

                await validateResponse(response);
                logger.info(`Callback successfully forwarded on attempt ${retryCount + 1}`);
                return true;
            } catch (err) {
                logger.error(`Attempt ${retryCount + 1} failed: ${err.message}`);
                retryCount++;
                if (retryCount < retryIntervals.length) {
                    const delay = retryIntervals[retryCount - 1];
                    logger.info(`Retrying in ${delay} seconds...`);
                    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
                } else {
                    logger.error("Exhausted retries.");
                    await logFailedCallback(payload, callbackUrl, retryCount, err.message);
                }
            }
        }
    } catch (error) {
        logger.error(`Critical error in forwardCallback: ${error.message}`);
        throw error; // Bubble up the error if the retries are exhausted
    } finally {
        decrementActiveTask(); // Decrement active task counter
        logger.info(`Task completed. Active tasks: ${activeTask}`);
    }
};

export const retryFailedCallbacks = async () => {
    const failedCallbacks = await FailedCallback.find();
    logger.info(`Retrying ${failedCallbacks.length} failed callbacks.`);
    for (const failedCallback of failedCallbacks) {
        try {
            await forwardCallback({
                payload: failedCallback.payload,
                retryCount: failedCallback.retryCount,
            });
            await failedCallback.deleteOne(); // Remove after successful retry
        } catch (err) {
            logger.error(`Retry for callback ${failedCallback._id} failed: ${err.message}`);
        }
    }
};
