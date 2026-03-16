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

interface OrderData {
    totalAmount: number;
    phoneNumber: string;
    items: Array<Record<string, any>>;
    paymentType?: string;
    storeId?: string;
    [key: string]: unknown;
}

export const createPaymentLink = async (order: OrderData) => {
    try {
        const requestId = generateRequestId();
        const merchantTradeNo = generateMerchantTradeNo();

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

        const { error } = validateCreateLinkRequest(requestBody);
        if (error) {
            logger.error("Payment validation failed: ", error.details[0].message);
            throw new ResponseError(400, `Payment validation failed: ${error.details[0].message}`);
        }

        const { headers } = generateHeaders("POST", "/payment/v2.1/h5/createLink", requestBody, requestId);
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/h5/createLink`, requestBody, { headers });

        logger.info("Payment link created successfully: ", response.data);
        return response.data;
    } catch (error) {
        logger.error("Error in createPaymentLink: ", error);
        throw error;
    }
};

export const callbackPaylabs = async ({ payload }: { payload: Record<string, any> }) => {
    try {
        const { error } = validateCallback(payload);
        if (error) {
            logger.error(
                "Callback validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

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

        const currentDateTime = new Date();
        const expiredDateTime = convertToDate(order.paymentExpired as string | number);

        const responsePayload = (errorCode: string | number, errCodeDes: string) => ({
            merchantId: process.env.PAYLABS_MERCHANT_ID,
            requestId: generateRequestId(),
            errCode: errorCode || notificationData.errCode,
            ...(errCodeDes && { errCodeDes }),
        });

        const payloadResponse = responsePayload(0, "");

        const { headers: responseHeaders } = generateHeaders(
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
        if (expiredDateTime && currentDateTime > expiredDateTime) {
            order.paymentStatus = "expired";

            broadcastPaymentUpdate({ paymentId: sanitizedPaymentId, status: "expired" });

            await order.save();
            return { currentDateTime, expiredDateTime, payloadResponseError };
        }

        switch (notificationData.status) {
            case "02":
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
                order.paymentPaylabs = { ...notificationData } as unknown as (typeof order.paymentPaylabs);

                if (notificationData.paymentMethodInfo?.vaCode) {
                    order.virtualAccountNo = notificationData.paymentMethodInfo.vaCode;
                }

                if (notificationData.paymentMethodInfo?.paymentCode) {
                    order.paymentCode = notificationData.paymentMethodInfo.paymentCode;
                }

                await order.save();

                broadcastPaymentUpdate({ paymentId: sanitizedPaymentId, status: "paid" });
                break;

            case "09":
                order.paymentStatus = "failed";
                await order.save();

                broadcastPaymentUpdate({ paymentId: sanitizedPaymentId, status: "failed" });
                break;

            default:
                logger.error(`Unhandled notification status: ${notificationData.status}`);
                throw new ResponseError(400, "Unhandled notification status");
        }

        return { responseHeaders, payloadResponse };
    } catch (error) {
        logger.error("Error in callbackPaylabs: ", error);
        throw error;
    }
};

export const callbackPaylabsVaStatic = async ({ payload }: { payload: Record<string, any> }) => {
    try {
        const { error } = validateCallback(payload);
        if (error) {
            logger.error(
                "Callback validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const notificationData = payload;

        const vaCode = notificationData.paymentMethodInfo.vaCode;
        if (typeof vaCode !== "string" || vaCode.trim() === "") {
            throw new ResponseError(400, "Invalid va code");
        }

        const sanitizedVaCode = vaCode.trim();
        const va = await VirtualAccount.findOne({ vaCode: sanitizedVaCode });

        if (!va) {
            throw new ResponseError(404, `Virtual account not found for vaCode: ${sanitizedVaCode}`);
        }

        switch (notificationData.status) {
            case "02":
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

            case "09":
                break;

            default:
                logger.error(`Unhandled notification status: ${notificationData.status}`);
                throw new ResponseError(400, "Unhandled notification status");
        }

        const responsePayload = {
            merchantId: process.env.PAYLABS_MERCHANT_ID,
            requestId: generateRequestId(),
            errCode: notificationData.errCode,
        };

        const { headers: responseHeaders } = generateHeaders(
            "POST",
            "/api/order/webhook/paylabs/va",
            responsePayload,
            generateRequestId(),
        );

        return { responseHeaders, responsePayload };
    } catch (error) {
        logger.error("Error in callbackPaylabsVaStatic: ", error);
        throw error;
    }
};
