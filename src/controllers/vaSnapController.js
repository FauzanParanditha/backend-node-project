import logger from "../application/logger.js";
import Order from "../models/orderModel.js";
import { publishToQueue } from "../rabbitmq/producer.js";
import { forwardCallbackSnap, forwardCallbackSnapDelete } from "../service/forwadCallback.js";
import { generateRequestId, generateTimestampSnap, verifySignature } from "../service/paylabs.js";
import * as vaSnapService from "../service/vaSnapService.js";
import { logCallback } from "../utils/logCallback.js";
import { orderSchema } from "../validators/orderValidator.js";

export const createVASNAP = async (req, res) => {
    const partnerId = req.partnerId;
    try {
        // Validate request payload
        const validatedProduct = await orderSchema.validateAsync(req.body, {
            abortEarly: false,
        });
        const { response, result } = await vaSnapService.createVASNAP({
            req,
            validatedProduct,
            partnerId,
        });

        // Respond with created order details
        res.status(200).json({
            success: true,
            partnerServiceId: response.data.virtualAccountData.partnerServiceId,
            customerNo: response.data.virtualAccountData.customerNo,
            virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
            totalAmount: response.data.virtualAccountData.totalAmount.value,
            paymentExpired: response.data.virtualAccountData.expiredDate,
            paymentId: response.data.virtualAccountData.trxId,
            storeId: response.data.virtualAccountData.additionalInfo.storeId,
            orderId: result.orderId,
            id: result._id,
        });
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error creating va snap: ${error.message}`);
        return res.status(500).json({
            success: false,
            status: error.status,
            message: "An error occurred",
            error: error.response
                ? `error: ${error.response.data.responseMessage} with code ${error.response.data.responseCode}`
                : error.message,
        });
    }
};

export const vaSNAPOrderStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const { responseHeaders, response } = await vaSnapService.vaSNAPOrderStatus({ id });
        // Respond
        res.set(responseHeaders).status(200).json(response.data);
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error fetching va snap status: ${error.message}`);
        return res.status(500).json({
            success: false,
            status: error.status,
            message: "An error occurred",
            error: error.response
                ? `error: ${error.response.data.responseMessage} with code ${error.response.data.responseCode}`
                : error.message,
        });
    }
};

export const VaSnapCallback = async (req, res, next) => {
    try {
        // Extract and verify signature
        const { "x-partner-id": partnerId, "x-signature": signature, "x-timestamp": timestamp } = req.headers;
        const { method: httpMethod } = req;

        const allowedPartnerId = process.env.PAYLABS_MERCHANT_ID;
        if (partnerId !== allowedPartnerId) {
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

        const endpointUrl = "/transfer-va/payment";
        if (!verifySignature(httpMethod, endpointUrl, payloadRaw, timestamp, signature)) {
            return res.status(401).send("Invalid signature");
        }

        // Validate transaction ID
        const trxId = payload.trxId;
        if (typeof trxId !== "string" || trxId.trim() === "") {
            throw new ResponseError(400, "Invalid transaction ID");
        }

        // Sanitize and query database
        const sanitizedTrxId = trxId.trim();
        const existOrder = await Order.findOne({ paymentId: sanitizedTrxId });
        if (!existOrder) {
            logger.error("Order not found for orderID: ", payload.trxId);
            throw new ResponseError(404, `Order not found for orderID: ${payload.trxId}`);
        }

        const currentDateTime = new Date();
        const expiredDateTime = new Date(existOrder.paymentExpired);

        const generateResponsePayload = (existOrder, statusCode, statusMessage) => ({
            responseCode: statusCode || "2002500",
            responseMessage: statusMessage || "Success",
            virtualAccountData: {
                partnerServiceId: existOrder.partnerServiceId,
                customerNo: existOrder.paymentPaylabsVaSnap.customerNo,
                virtualAccountNo: existOrder.paymentPaylabsVaSnap.virtualAccountNo,
                virtualAccountName: existOrder.paymentPaylabsVaSnap.virtualAccountName,
                paymentRequestId: generateRequestId(),
            },
        });

        const payloadResponse = generateResponsePayload(existOrder, "2002500", "Success");

        const responseHeaders = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": generateTimestampSnap(),
        };

        // const { responseHeaders, payloadResponse, currentDateTime, expiredDateTime, payloadResponseError } =
        //     await vaSnapService.VaSnapCallback({ payload });

        if (currentDateTime > expiredDateTime) {
            const payloadResponseError = generateResponsePayload(existOrder, "4030000", "Expired");
            res.set(responseHeaders).status(403).json(payloadResponseError);
        }

        await logCallback({
            type: "incoming",
            source: "paylabs",
            target: "internal",
            status: "success",
            payload,
            response: payloadResponse,
            requestId: payload.paymentRequestId,
        });

        try {
            await publishToQueue("payment_events_va_snap", payload);
        } catch (error) {
            logger.error(`Failed to publish to queue: ${err.message}`);
        }

        // Respond
        res.set(responseHeaders).status(200).json(payloadResponse);

        forwardCallbackSnap({ payload }).catch(async (err) => {
            logger.error(err.message);
            await logCallback({
                type: "forward",
                source: "internal",
                target: "client",
                status: "failed",
                payload,
                errorMessage: err.message,
                requestId: payload.paymentRequestId,
            });
        });
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error handling webhook va snap: ${error.message}`);
        await logCallback({
            type: "incoming",
            source: "paylabs",
            target: "internal",
            status: "error",
            payload: req.body instanceof Buffer ? req.body.toString("utf8") : req.body,
            errorMessage: error.message,
            requestId: payload.paymentRequestId,
        });
        next(error);
    }
};

export const updateVASNAP = async (req, res) => {
    const { id } = req.params;
    try {
        // Validate the update payload
        const validatedUpdateData = await orderSchema.validateAsync(req.body, {
            abortEarly: false,
        });

        const { currentDateTime, expiredDateTime, response } = await vaSnapService.updateVASNAP({
            id,
            validatedUpdateData,
            req,
        });

        if (currentDateTime > expiredDateTime) {
            return res.status(408).json({
                success: true,
                message: "payment expired",
            });
        }
        // Send a response with the updated order details
        res.status(200).json({
            success: true,
            partnerServiceId: response.data.virtualAccountData.partnerServiceId,
            customerNo: response.data.virtualAccountData.customerNo,
            virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
            totalAmount: response.data.virtualAccountData.totalAmount.value,
            expiredDate: response.data.virtualAccountData.expiredDate,
            paymentId: response.data.virtualAccountData.trxId,
            orderId: id,
        });
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error update va snap: ${error.message}`);
        return res.status(500).json({
            success: false,
            status: error.status,
            message: "An error occurred",
            error: error.response
                ? `error: ${error.response.data.responseMessage} with code ${error.response.data.responseCode}`
                : error.message,
        });
    }
};

export const deleteVASNAP = async (req, res) => {
    const { id } = req.params;
    try {
        const { currentDateTime, expiredDateTime, response, responseHeaders } = await vaSnapService.deleteVASNAP({
            id,
            req,
        });

        if (currentDateTime > expiredDateTime) {
            return res.status(408).json({
                success: true,
                message: "payment expired",
            });
        }

        await logCallback({
            type: "incoming",
            source: "paylabs",
            target: "internal",
            status: "success",
            payload: response.data,
            response: response.data,
            // requestId,
        });

        // Send a response with the updated order details
        res.set(responseHeaders).status(200).json(response.data);

        const payload = response.data;
        forwardCallbackSnapDelete({ payload }).catch(async (err) => {
            logger.error(err.message);
            await logCallback({
                type: "forward",
                source: "internal",
                target: "client",
                status: "failed",
                payload,
                errorMessage: err.message,
                // requestId,
            });
        });
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error delete va snap: ${error.message}`);
        await logCallback({
            type: "incoming",
            source: "paylabs",
            target: "internal",
            status: "error",
            payload: req.body instanceof Buffer ? req.body.toString("utf8") : req.body,
            errorMessage: error.message,
            // requestId,
        });
        return res.status(500).json({
            success: false,
            status: error.status,
            message: "An error occurred",
            error: error.response
                ? `error: ${error.response.data.responseMessage} with code ${error.response.data.responseCode}`
                : error.message,
        });
    }
};
