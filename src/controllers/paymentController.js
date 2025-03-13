import logger from "../application/logger.js";
import Order from "../models/orderModel.js";
import { publishToQueue } from "../rabbitmq/producer.js";
import { forwardCallback } from "../service/forwadCallback.js";
import { convertToDate, generateHeaders, generateRequestId, verifySignature } from "../service/paylabs.js";
import * as paymentService from "../service/paymentService.js";

// Handle Paylabs callback notifications
export const paylabsCallback = async (req, res, next) => {
    try {
        const { "x-partner-id": partnerId, "x-signature": signature, "x-timestamp": timestamp } = req.headers;
        const { method: httpMethod, originalUrl: endpointUrl } = req;

        if (partnerId !== process.env.PAYLABS_MERCHANT_ID) {
            return res.status(401).send("Invalid partner ID");
        }

        const payloadRaw = req.body.toString("utf8").trim();
        logger.info(`Raw Payload: ${payloadRaw}`);

        let payload;
        try {
            payload = JSON.parse(payloadRaw);
        } catch (err) {
            logger.error(`Failed to parse JSON payload: ${err.message}`);
            return res.status(400).json({ error: "Invalid JSON payload" });
        }

        if (!verifySignature(httpMethod, endpointUrl, payloadRaw, timestamp, signature)) {
            logger.error(`Signature verification failed: partnerId=${partnerId}, payload=${payloadRaw}`);
            return res.status(401).send("Invalid signature");
        }

        // Validate payment ID
        const paymentId = payload.merchantTradeNo;
        if (typeof paymentId !== "string" || paymentId.trim() === "") {
            throw new ResponseError(400, "Invalid transaction ID");
        }

        // Sanitize and query database
        const sanitizedPaymentId = paymentId.trim();
        const order = await Order.findOne({ paymentId: sanitizedPaymentId });
        if (!order) {
            throw new ResponseError(404, `Order not found for orderID: ${sanitizedPaymentId}`);
        }

        const currentDateTime = new Date();
        const expiredDateTime = convertToDate(order.paymentExpired);

        // Prepare response payload and headers
        const responsePayload = (errorCode, errCodeDes) => ({
            merchantId: process.env.PAYLABS_MERCHANT_ID,
            requestId: generateRequestId(),
            errCode: errorCode || payload.errCode,
            ...(errCodeDes && { errCodeDes }),
        });

        const payloadResponse = responsePayload(0, "");

        const { responseHeaders } = generateHeaders(
            "POST",
            "/api/order/webhook/paylabs",
            payloadResponse,
            generateRequestId(),
        );

        // const { responseHeaders, payloadResponse, currentDateTime, expiredDateTime, payloadResponseError } =
        //     await paymentService.callbackPaylabs({ payload });

        if (expiredDateTime && currentDateTime > expiredDateTime) {
            const payloadResponseError = responsePayload("orderExpired", "order expired");
            return res.status(200).json(payloadResponseError);
        }

        try {
            await publishToQueue("payment_events", payload);
        } catch (err) {
            logger.error(`Failed to publish to queue: ${err.message}`);
        }

        res.set(responseHeaders).status(200).json(payloadResponse);

        await forwardCallback({ payload });
    } catch (error) {
        logger.error(
            `Error handling webhook paylabs: ${error.message}, rawBody: ${
                req.body instanceof Buffer ? req.body.toString("utf8") : req.body
            }`,
        );
        next(error);
    }
};

export const paylabsVaStaticCallback = async (req, res, next) => {
    try {
        const { "x-partner-id": partnerId, "x-signature": signature, "x-timestamp": timestamp } = req.headers;
        const { body: payload, method: httpMethod, originalUrl: endpointUrl } = req;

        const allowedPartnerId = process.env.PAYLABS_MERCHANT_ID;
        if (partnerId !== allowedPartnerId) {
            return res.status(401).send("Invalid partner ID");
        }

        if (!verifySignature(httpMethod, endpointUrl, payload, timestamp, signature)) {
            return res.status(401).send("Invalid signature");
        }

        const { responseHeaders, responsePayload } = await paymentService.callbackPaylabsVaStatic({ payload });

        res.set(responseHeaders).status(200).json(responsePayload);

        await forwardCallback({ payload });
    } catch (error) {
        logger.error(`Error handling webhook va static: ${error.message}`);
        next(error);
    }
};
