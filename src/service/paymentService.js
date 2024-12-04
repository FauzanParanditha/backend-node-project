import axios from "axios";
import { validateCallback, validateCreateLinkRequest } from "../validators/paymentValidator.js";
import {
    convertToDate,
    createSignature,
    generateHeaders,
    generateMerchantTradeNo,
    generateRequestId,
    generateTimestamp,
    merchantId,
    paylabsApiUrl,
} from "./paylabs.js";
import Order from "../models/orderModel.js";
import { ResponseError } from "../error/responseError.js";
import VirtualAccount from "../models/vaModel.js";
import uuid4 from "uuid4";

export const createPaymentLink = async (order) => {
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
        productName: order.products.map((p) => p.title).join(", "),
        redirectUrl: process.env.REDIRECT_URL,
        ...(order.paymentType && { paymentType: order.paymentType }),
        ...(order.storeId && { storeId: order.storeId }),
        notifyUrl: process.env.NOTIFY_URL,
        feeType: "OUR",
    };

    // Validate request body
    const { error } = validateCreateLinkRequest(requestBody);
    if (error) throw new ResponseError(400, `Payment validation failed: ${error.details[0].message}`);

    // Generate headers for Paylabs request
    const { headers } = generateHeaders("POST", "/payment/v2.1/h5/createLink", requestBody, requestId);
    // console.log(requestBody);
    // console.log(headers);

    // Make API request to Paylabs
    const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/h5/createLink`, requestBody, { headers });

    // console.log("Response:", response.data);
    return response.data;
};

export const callbackPaylabs = async ({ payload }) => {
    const { error } = validateCallback(payload);
    if (error)
        throw new ResponseError(
            400,
            error.details.map((err) => err.message),
        );

    // Retrieve notification data and order
    const notificationData = payload;

    //validate payment ID
    const paymentId = notificationData.merchantTradeNo;
    if (typeof paymentId !== "string" || paymentId.trim() === "") {
        throw new ResponseError(400, "Invalid transaction ID");
    }

    //Sanitize and query database
    const sanitizedPaymentId = paymentId.trim();
    const order = await Order.findOne({
        paymentId: sanitizedPaymentId,
    });
    if (!order) throw new ResponseError(404, `Order not found for orderID: ${sanitizedPaymentId}`);

    if (order.paymentStatus === "paid") throw new ResponseError(200, "Payment already processed!");

    const currentDateTime = new Date();
    const expiredDateTime = convertToDate(order.paymentExpired);

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
            break;

        case "09": // Payment failed
            order.paymentStatus = "failed";
            await order.save();
            break;

        default:
            logger.error(`Unhandled notification status: ${notificationData.status}`);
            throw new ResponseError(400, "Unhandled notification status");
    }

    // Prepare response payload and headers
    const timestampResponse = generateTimestamp();
    const responsePayload = (errorCode, errCodeDes) => {
        return {
            merchantId: process.env.PAYLABS_MERCHANT_ID,
            requestId: generateRequestId(),
            errCode: errorCode ? errorCode : notificationData.errCode,
            ...(errCodeDes && { errCodeDes: errCodeDes }),
        };
    };

    const payloadResponse = responsePayload(0, "");

    const { responseHeaders } = generateHeaders(
        "POST",
        "/api/order/webhook/paylabs",
        payloadResponse,
        generateRequestId(),
    );

    const payloadResponseError = responsePayload("orderExpired", "order expired");
    if (currentDateTime > expiredDateTime && expiredDateTime != null) {
        order.paymentStatus = "expired";
        await order.save();
        return { currentDateTime, expiredDateTime, payloadResponseError };
    }

    return { responseHeaders, payloadResponse };
};

export const callbackPaylabsVaStatic = async ({ payload }) => {
    const { error } = validateCallback(payload);
    if (error)
        throw new ResponseError(
            400,
            error.details.map((err) => err.message),
        );

    // Retrieve notification data and order
    const notificationData = payload;

    //validate va code
    const vaCode = notificationData.paymentMethodInfo.vaCode;
    if (typeof vaCode !== "string" || vaCode.trim() === "") {
        throw new ResponseError(400, "Invalid va code");
    }

    //Sanitize and query database
    const sanitizedVaCode = vaCode.trim();
    const va = await VirtualAccount.findOne({
        vaCode: sanitizedVaCode,
    });

    if (!va) throw new ResponseError(404, `virtual account not found for vaCode: ${sanitizedVaCode}`);

    // Process based on notification status
    switch (notificationData.status) {
        case "02": // Payment successful
            await Order.create({
                orderId: uuid4(),
                payer: va.payer,
                totalAmount: notificationData.amount,
                phoneNumber: va.phoneNumber,
                paymentStatus: "paid",
                paymentMethod: "paylabs",
                paymentType: notificationData.paymentType,
                virtualAccountNo: notificationData.paymentMethodInfo.vaCode,
                paymentId: notificationData.merchantTradeNo,
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
    const timestampResponse = generateTimestamp();
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
};
