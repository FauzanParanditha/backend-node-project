import axios from "axios";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import FailedCallback from "../models/failedForwardModel.js";
import Order from "../models/orderModel.js";
import { validateCallback } from "../validators/paymentValidator.js";
import { generateHeadersForward, generateRequestId, verifySignatureForward } from "./paylabs.js";

export const forwardCallback = async ({ payload }) => {
    const retryIntervals = [5, 15, 30, 60, 300, 900, 1800]; // Retry intervals in seconds
    let attempt = 0;

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
        try {
            // Check if required headers exist
            const {
                "content-type": contentType,
                "x-timestamp": timestamp,
                "x-signature": signature,
                "x-request-id": requestId,
            } = response.headers;

            if (!contentType || contentType.toLowerCase() !== "application/json; charset=utf-8") {
                throw new Error("Missing or invalid Content-Type header");
            }

            if (!timestamp) {
                throw new Error("Missing X-TIMESTAMP header");
            }

            if (!signature) {
                throw new Error("Missing X-SIGNATURE header");
            }

            if (!requestId) {
                throw new Error("Missing X-REQUEST-ID header");
            }

            // Validate the body
            const { requestId: bodyRequestId, errCode } = response.data;

            if (!bodyRequestId) {
                throw new Error("Missing requestId in response body");
            }

            if (errCode !== "0") {
                throw new Error(`Invalid errCode in response body: ${errCode}`);
            }

            // Signature verification (optional, if needed)
            const httpMethod = response.request.method;
            const endpointUrl = response.request.path;
            const payload = response.data;

            if (!verifySignatureForward(httpMethod, endpointUrl, payload, timestamp, signature)) {
                throw new Error("Invalid signature in response validation");
            }

            return true; // If everything is valid
        } catch (error) {
            throw new Error(`Response validation failed: ${error.message}`);
        }
    };

    try {
        logger.info(`Attempting to forward callback`);

        const { error } = validateCallback(payload);
        if (error) {
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Retrieve notification data and order
        const notificationData = payload;
        const paymentId = notificationData.merchantTradeNo;
        if (typeof paymentId !== "string" || paymentId.trim() === "") {
            throw new ResponseError(400, "Invalid transaction ID");
        }

        const sanitizedPaymentId = paymentId.trim();
        const order = await Order.findOne({ paymentId: sanitizedPaymentId });
        if (!order) {
            throw new ResponseError(404, `Order not found for orderID: ${sanitizedPaymentId}`);
        }

        const callbackUrl = order.forwardUrl;
        if (!callbackUrl) {
            throw new ResponseError(400, "Missing callback URL in the order");
        }

        while (attempt < retryIntervals.length) {
            attempt++;
            try {
                const { headers: responseHeaders } = generateHeadersForward(
                    "POST",
                    "/callback",
                    notificationData,
                    generateRequestId(),
                );

                const response = await axios.post(callbackUrl, notificationData, {
                    headers: responseHeaders,
                });

                await validateResponse(response);
                logger.info(`Callback successfully forwarded on attempt ${attempt}`);
                return true; // Exit if successful
            } catch (error) {
                logger.error(`Attempt ${attempt} failed: ${error.message}`);
                if (attempt < retryIntervals.length) {
                    const delay = retryIntervals[attempt - 1];
                    logger.info(`Retrying in ${delay} seconds...`);
                    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
                } else {
                    logger.error("All retry attempts failed");
                    await logFailedCallback(payload, callbackUrl, attempt, error.message);
                    break;
                }
            }
        }
    } catch (error) {
        logger.error(`Critical error in forwardCallback: ${error.message}`);
        throw error; // Bubble up the error if the retries are exhausted
    }
};
