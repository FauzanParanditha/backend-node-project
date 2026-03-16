import type { PaymentPartner } from "../types/express.js";
import axios from "axios";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import Order from "../models/orderModel.js";
import { generateOrderId, validateOrderProducts } from "../utils/helper.js";
import { validateEMoneyRefund, validateEMoneyRequest, validateEmoneyStatus } from "../validators/paymentValidator.js";
import { generateHeaders, generateMerchantTradeNo, generateRequestId, merchantId, paylabsApiUrl } from "./paylabs.js";


export const createEMoney = async ({
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
            throw new ResponseError(404, "No valid products found to create the order");
        }

        const requestBodyForm = {
            orderId: await generateOrderId(partnerId.clientId),
            userId: validatedProduct.userId,
            items: itemsForDb,
            totalAmount,
            phoneNumber: validatedProduct.phoneNumber,
            paymentStatus: "pending",
            payer: partnerId.name,
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
            paymentParams: {
                redirectUrl: process.env.REDIRECT_URL,
                ...(requestBodyForm.paymentType === "OVOBALANCE" && {
                    phoneNumber: requestBodyForm.phoneNumber,
                }),
            },
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

        const { error } = validateEMoneyRequest(requestBody);
        if (error) {
            logger.error(
                "Validation error: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const { headers } = generateHeaders("POST", "/payment/v2.1/ewallet/create", requestBody, requestId);
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/ewallet/create`, requestBody, { headers });

        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCode : "failed to create payment");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCode}` : "failed to create payment",
            );
        }

        const result = await Order.create({
            ...requestBodyForm,
            totalAmount: response.data.amount,
            paymentActions: response.data.paymentActions,
            paymentId: response.data.merchantTradeNo,
            paymentExpired: response.data.expiredTime,
            storeId: response.data.storeId,
            eMoney: response.data,
        });

        logger.info("E-Money order created successfully");
        return { response, result };
    } catch (error) {
        logger.error("Error in createEMoney: ", error);
        throw error;
    }
};

export const eMoneyOrderStatus = async ({ id }: { id: string }) => {
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

        const { error } = validateEmoneyStatus(requestBody);
        if (error) {
            logger.error(
                "Validation error: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const { headers } = generateHeaders("POST", "/payment/v2.1/ewallet/query", requestBody, requestId);
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/ewallet/query`, requestBody, { headers });

        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCode : "failed to query payment status");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCode}` : "failed to query payment status",
            );
        }

        const { headers: responseHeaders } = generateHeaders(
            "POST",
            "/api/order/status/ewallet/:id",
            response.data,
            generateRequestId(),
        );

        logger.info("E-Money order status retrieved successfully: ", response.data);
        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in eMoneyOrderStatus: ", error);
        throw error;
    }
};

export const refundEmoney = async ({ id, validatedRequest }: { id: string; validatedRequest: Record<string, any> }) => {
    try {
        const existOrder = await Order.findById(id);
        if (!existOrder) {
            logger.error("Order does not exist: ", id);
            throw new ResponseError(404, "Order does not exist!");
        }

        if (!existOrder.paymentPaylabs) {
            logger.error("Order not completed: ", id);
            throw new ResponseError(400, "Order does not completed!");
        }

        if (existOrder.paymentType === "OVOBALANCE") {
            logger.error("Refunds are not supported for OVOBALANCE payment type for order: ", id);
            throw new ResponseError(400, "Refunds are not supported for OVOBALANCE payment type.");
        }

        const requestId = generateRequestId();
        const refundNo = generateMerchantTradeNo();

        const paymentPaylabs = existOrder.paymentPaylabs as Record<string, any>;
        const requestBody = {
            requestId,
            merchantId,
            ...(existOrder.storeId && { storeId: existOrder.storeId }),
            merchantTradeNo: existOrder.paymentId,
            paymentType: existOrder.paymentType,
            amount: existOrder.totalAmount,
            refundAmount: existOrder.totalAmount,
            platformRefundNo: refundNo,
            merchantRefundNo: refundNo,
            notifyUrl: `${process.env.NOTIFY_URL}/refund`,
            reason: validatedRequest.reason,
            transFeeRate: paymentPaylabs.transFeeRate,
            transFeeAmount: paymentPaylabs.transFeeAmount,
            totalTransFee: paymentPaylabs.totalTransFee,
        };

        const { error } = validateEMoneyRefund(requestBody);
        if (error) {
            logger.error(
                "Validation error: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const { headers } = generateHeaders("POST", "/payment/v2.1/ewallet/refund", requestBody, requestId);
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/ewallet/refund`, requestBody, { headers });

        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCode : "failed to process refund");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCode}` : "failed to process refund",
            );
        }

        const { headers: responseHeaders } = generateHeaders(
            "POST",
            "/api/order/refund/ewallet/:id",
            response.data,
            generateRequestId(),
        );

        logger.info("E-Money refund processed successfully: ", response.data);
        return { response, responseHeaders };
    } catch (error: unknown) {
        const axiosError = error as { response?: { status: number; statusText: string } };
        if (axiosError.response) {
            logger.error(
                `Error in refundEmoney: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.statusText)}`,
            );
        } else {
            logger.error("Error in refundEmoney: ", error);
        }
        throw error;
    }
};
