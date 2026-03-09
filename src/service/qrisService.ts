import axios from "axios";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import Order from "../models/orderModel.js";
import type { PaymentPartner } from "../types/express.js";
import { generateOrderId, validateOrderProducts } from "../utils/helper.js";
import { cancelQrisValidator, validateQrisRequest, validateQrisStatus } from "../validators/paymentValidator.js";
import { sendPartnerApiErrorAlert } from "./discordService.js";
import {
    convertToDate,
    generateHeaders,
    generateMerchantTradeNo,
    generateRequestId,
    merchantId,
    paylabsApiUrl,
} from "./paylabs.js";

export const createQris = async ({
    validatedProduct,
    partnerId,
}: {
    validatedProduct: Record<string, any>;
    partnerId: PaymentPartner;
}) => {
    try {
        const { validProducts, itemsForDb, totalAmount } = await validateOrderProducts(
            validatedProduct.items,
            validatedProduct.paymentType,
            validatedProduct.totalAmount,
        );
        if (!validProducts.length) {
            logger.error("No valid products found to create the order");
            throw new ResponseError(404, "No valid products found to update the order");
        }

        const requestBodyForm = {
            orderId: await generateOrderId(partnerId.clientId),
            userId: validatedProduct.userId,
            items: itemsForDb,
            totalAmount,
            phoneNumber: validatedProduct.phoneNumber,
            paymentStatus: "pending",
            payer: partnerId.name,
            paymentExpired: validatedProduct.expire ? validatedProduct.expire : 300,
            paymentMethod: validatedProduct.paymentMethod,
            paymentType: validatedProduct.paymentType,
            clientId: partnerId.clientId,
            ...(validatedProduct.storeId && { storeId: validatedProduct.storeId }),
        };

        const requestId = generateRequestId();
        const merchantTradeNo = generateMerchantTradeNo();

        const requestBody = {
            requestId,
            merchantId,
            ...(requestBodyForm.storeId && { storeId: requestBodyForm.storeId }),
            paymentType: requestBodyForm.paymentType,
            amount: requestBodyForm.totalAmount,
            merchantTradeNo,
            notifyUrl: process.env.NOTIFY_URL,
            expire: requestBodyForm.paymentExpired,
            feeType: "OUR",
            productName: requestBodyForm.items.map((p: Record<string, any>) => p.name).join(", "),
            productInfo: requestBodyForm.items.map((product: Record<string, any>) => ({
                id: product.id,
                name: product.name,
                price: product.price,
                type: product.type,
                quantity: product.quantity,
            })),
        };

        const { error } = validateQrisRequest(requestBody);
        if (error) {
            logger.error(
                "QRIS request validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const { headers } = generateHeaders("POST", "/payment/v2.1/qris/create", requestBody, requestId);
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/qris/create`, requestBody, { headers });

        if (!response.data || response.data.errCode !== "0") {
            const errMsg = response.data ? `error: ${response.data.errCode}` : "failed to create payment";
            logger.error(`Paylabs error: ${errMsg}`);
            sendPartnerApiErrorAlert("Paylabs (QRIS)", "/payment/v2.1/qris/create", errMsg).catch(console.error);
            throw new ResponseError(400, errMsg);
        }

        const result = await Order.create({
            ...requestBodyForm,
            totalAmount: response.data.amount,
            paymentLink: response.data.qrisUrl,
            paymentId: response.data.merchantTradeNo,
            paymentExpired: response.data.expiredTime,
            storeId: response.data.storeId,
            qris: response.data,
        });

        logger.info("QRIS payment created successfully");
        return { response, result };
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            sendPartnerApiErrorAlert("Paylabs Network (QRIS)", "/payment/v2.1/qris/create", error.message).catch(
                console.error,
            );
        }
        logger.error("Error in createQris: ", error);
        throw error;
    }
};

export const qrisOrderStatus = async ({ id }: { id: string }) => {
    try {
        const existOrder = await Order.findById(id);
        if (!existOrder) {
            logger.error("Order does not exist: ", id);
            throw new ResponseError(404, "Order does not exist!");
        }

        const requestId = generateRequestId();
        const requestBody = {
            requestId,
            merchantId,
            ...(existOrder.storeId && { storeId: existOrder.storeId }),
            merchantTradeNo: existOrder.paymentId,
            paymentType: existOrder.paymentType,
        };

        const { error } = validateQrisStatus(requestBody);
        if (error) {
            logger.error(
                "QRIS status validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const { headers } = generateHeaders("POST", "/payment/v2.1/qris/query", requestBody, requestId);
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/qris/query`, requestBody, { headers });

        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCode : "failed to query payment status");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCode}` : "failed to query payment status",
            );
        }

        const { headers: responseHeaders } = generateHeaders(
            "POST",
            "/api/order/status/qris/:id",
            response.data,
            requestId,
        );

        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in qrisOrderStatus: ", error);
        throw error;
    }
};

export const cancelQris = async ({ id }: { id: string }) => {
    try {
        const existOrder = await Order.findById(id);
        if (!existOrder) {
            logger.error("Order does not exist: ", id);
            throw new ResponseError(404, "Order does not exist!");
        }

        const currentDateTime = new Date();
        const expiredDateTime = convertToDate(existOrder.paymentExpired as string | number);

        if (expiredDateTime && currentDateTime > expiredDateTime) {
            existOrder.paymentStatus = "expired";
            const payloadResponseError = {
                merchantId: process.env.PAYLABS_MERCHANT_ID,
                requestId: generateRequestId(),
                errCode: "orderExpired",
                errCodeDes: "order expired",
            };
            await existOrder.save();
            return { currentDateTime, expiredDateTime, payloadResponseError };
        }

        if (existOrder.paymentStatus === "paid") {
            logger.error("Payment already processed for order: ", id);
            throw new ResponseError(409, "Payment already processed!");
        }

        const qrisData = existOrder.qris as Record<string, any>;
        const requestId = generateRequestId();
        const requestBody = {
            requestId,
            merchantId,
            ...(existOrder.storeId && { storeId: existOrder.storeId }),
            merchantTradeNo: existOrder.paymentId,
            platformTradeNo: qrisData.platformTradeNo,
            qrCode: qrisData.qrCode,
        };

        const { error } = cancelQrisValidator(requestBody);
        if (error) {
            logger.error(
                "QRIS cancel validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const { headers } = generateHeaders("POST", "/payment/v2.1/qris/cancel", requestBody, requestId);
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/qris/cancel`, requestBody, { headers });

        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCode : "failed to cancel payment");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCode}` : "failed to cancel payment",
            );
        }

        existOrder.paymentLink = undefined;
        existOrder.paymentStatus = "cancel";
        Object.assign(existOrder.qris!, response.data);
        await existOrder.save();

        const { headers: responseHeaders } = generateHeaders(
            "POST",
            "/payment/v2.1/qris/cancel",
            response.data,
            generateRequestId(),
        );

        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in cancelQris: ", error);
        throw error;
    }
};
