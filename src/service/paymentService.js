import axios from "axios";
import logger from "../application/logger.js";
import { broadcastPaymentUpdate } from "../application/websocket_server.js";
import { ResponseError } from "../error/responseError.js";
import Order from "../models/orderModel.js";
import VirtualAccount from "../models/vaModel.js";
import { generateOrderId } from "../utils/helper.js";
import { validateCallback, validateCreateLinkRequest } from "../validators/paymentValidator.js";
import {
    convertToDate,
    generateHeaders,
    generateMerchantTradeNo,
    generateRequestId,
    merchantId,
    paylabsApiUrl,
} from "./paylabs.js";

export const createPaymentLink = async (order) => {
    try {
        // Configuration and unique identifiers
        const requestId = generateRequestId();
        const merchantTradeNo = generateMerchantTradeNo();

        // Prepare request payload
        const requestBody = {
            merchantId,
            merchantTradeNo,
            requestId,
            amount: order.totalAmount,
            phoneNumber: order.phoneNumber,
            productName: order.items.map((p) => p.name).join(", "),
            redirectUrl: process.env.REDIRECT_URL,
            ...(order.paymentType && { paymentType: order.paymentType }),
            ...(order.storeId && { storeId: order.storeId }),
            notifyUrl: process.env.NOTIFY_URL,
            feeType: "OUR",
        };

        // Validate request body
        const { error } = validateCreateLinkRequest(requestBody);
        if (error) {
            logger.error("Payment validation failed: ", error.details[0].message);
            throw new ResponseError(400, `Payment validation failed: ${error.details[0].message}`);
        }

        // Generate headers for Paylabs request
        const { headers } = generateHeaders("POST", "/payment/v2.1/h5/createLink", requestBody, requestId);

        // Make API request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/h5/createLink`, requestBody, { headers });

        logger.info("Payment link created successfully: ", response.data);
        return response.data;
    } catch (error) {
        logger.error("Error in createPaymentLink: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const callbackPaylabs = async ({ payload }) => {
    try {
        const { error } = validateCallback(payload);
        if (error) {
            logger.error(
                "Callback validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Retrieve notification data and order
        const notificationData = payload;

        // Validate payment ID
        const paymentId = notificationData.merchantTradeNo;
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
            errCode: errorCode || notificationData.errCode,
            ...(errCodeDes && { errCodeDes }),
        });

        const payloadResponse = responsePayload(0, "");

        const { responseHeaders } = generateHeaders(
            "POST",
            "/api/order/webhook/paylabs",
            payloadResponse,
            generateRequestId(),
        );

        if (order.paymentStatus === "paid") {
            logger.info(`Order ${paymentId} already paid, skipping processing`);
            return { responseHeaders, payloadResponse };
        }

        const payloadResponseError = responsePayload("orderExpired", "order expired");
        if (currentDateTime > expiredDateTime && expiredDateTime != null) {
            order.paymentStatus = "expired";

            broadcastPaymentUpdate({ paymentId: sanitizedPaymentId, status: "expired" });

            await order.save();
            return { currentDateTime, expiredDateTime, payloadResponseError };
        }

        // Process based on notification status
        switch (notificationData.status) {
            case "02": // Payment successful
                order.paymentStatus = "paid";
                order.totalAmount = notificationData.amount;
                order.paymentType = notificationData.paymentType;
                order.paymentLink = undefined;
                order.paymentActions = undefined;
                order.qris = undefined;
                order.va = undefined;
                order.vaSnap = undefined;
                order.cc = undefined;
                order.eMoney = undefined;
                order.paymentPaylabs = { ...notificationData };

                if (notificationData.paymentMethodInfo?.vaCode) {
                    order.virtualAccountNo = notificationData.paymentMethodInfo.vaCode;
                }

                if (notificationData.paymentMethodInfo?.paymentCode) {
                    order.paymentCode = notificationData.paymentMethodInfo.paymentCode;
                }

                await order.save();

                // Broadcast the payment update to all connected clients
                broadcastPaymentUpdate({ paymentId: sanitizedPaymentId, status: "paid" });
                break;

            case "09": // Payment failed
                order.paymentStatus = "failed";
                await order.save();

                // Broadcast the payment update to all connected clients
                broadcastPaymentUpdate({ paymentId: sanitizedPaymentId, status: "failed" });
                break;

            default:
                logger.error(`Unhandled notification status: ${notificationData.status}`);
                throw new ResponseError(400, "Unhandled notification status");
        }

        return { responseHeaders, payloadResponse };
    } catch (error) {
        logger.error("Error in callbackPaylabs: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const callbackPaylabsVaStatic = async ({ payload }) => {
    try {
        const { error } = validateCallback(payload);
        if (error) {
            logger.error(
                "Callback validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Retrieve notification data and order
        const notificationData = payload;

        // Validate va code
        const vaCode = notificationData.paymentMethodInfo.vaCode;
        if (typeof vaCode !== "string" || vaCode.trim() === "") {
            throw new ResponseError(400, "Invalid va code");
        }

        // Sanitize and query database
        const sanitizedVaCode = vaCode.trim();
        const va = await VirtualAccount.findOne({ vaCode: sanitizedVaCode });

        if (!va) {
            throw new ResponseError(404, `Virtual account not found for vaCode: ${sanitizedVaCode}`);
        }

        // Process based on notification status
        switch (notificationData.status) {
            case "02": // Payment successful
                await Order.create({
                    orderId: await generateOrderId(va.clientId),
                    payer: va.payer,
                    totalAmount: notificationData.amount,
                    phoneNumber: va.phoneNumber,
                    paymentStatus: "paid",
                    paymentMethod: "paylabs",
                    paymentType: notificationData.paymentType,
                    virtualAccountNo: notificationData.paymentMethodInfo.vaCode,
                    paymentId: notificationData.merchantTradeNo,
                    clientId: va.clientId,
                    paymentPaylabs: { ...notificationData },
                });
                break;

            case "09": // Payment failed
                break;

            default:
                logger.error(`Unhandled notification status: ${notificationData.status}`);
                throw new ResponseError(400, "Unhandled notification status");
        }

        // Prepare response payload and headers
        const responsePayload = {
            merchantId: process.env.PAYLABS_MERCHANT_ID,
            requestId: generateRequestId(),
            errCode: notificationData.errCode,
        };

        const { responseHeaders } = generateHeaders(
            "POST",
            "/api/order/webhook/paylabs/va",
            responsePayload,
            generateRequestId(),
        );

        return { responseHeaders, responsePayload };
    } catch (error) {
        logger.error("Error in callbackPaylabsVaStatic: ", error);
        throw error; // Re-throw the error for further handling
    }
};
