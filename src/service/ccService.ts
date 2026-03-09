import type { PaymentPartner } from "../types/express.js";
import axios from "axios";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import Order from "../models/orderModel.js";
import { generateOrderId, validateOrderProducts } from "../utils/helper.js";
import { validateCCStatus, validateCreditCardRequest } from "../validators/paymentValidator.js";
import { generateHeaders, generateMerchantTradeNo, generateRequestId, merchantId, paylabsApiUrl } from "./paylabs.js";


export const createCC = async ({
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
            },
            productName: requestBodyForm.items.map((p: Record<string, any>) => p.name).join(", "),
            productInfo: requestBodyForm.items.map((product: Record<string, any>) => ({
                id: product.id,
                name: product.name,
                price: product.price,
                type: product.type,
                quantity: product.quantity,
            })),
            feeType: "OUR",
        };

        const { error } = validateCreditCardRequest(requestBody);
        if (error) {
            logger.error(
                "Validation error: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const { headers } = generateHeaders("POST", "/payment/v2.1/cc/create", requestBody, requestId);
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/cc/create`, requestBody, { headers });

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
            paymentLink: response.data.paymentActions.payUrl,
            paymentId: response.data.merchantTradeNo,
            paymentExpired: response.data.expiredTime,
            storeId: response.data.storeId,
            cc: response.data,
        });

        logger.info("Order created successfully");
        return { response, result };
    } catch (error) {
        logger.error("Error in createCC: ", error);
        throw error;
    }
};

export const ccOrderStatus = async ({ id }: { id: string }) => {
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

        const { error } = validateCCStatus(requestBody);
        if (error) {
            logger.error(
                "Validation error: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const { headers } = generateHeaders("POST", "/payment/v2.1/cc/query", requestBody, requestId);
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/cc/query`, requestBody, { headers });

        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCode : "failed to query payment status");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCode}` : "failed to query payment status",
            );
        }

        const { headers: responseHeaders } = generateHeaders(
            "POST",
            "/api/order/status/cc/:id",
            response.data,
            generateRequestId(),
        );

        logger.info("Order status retrieved successfully: ", response.data);
        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in ccOrderStatus: ", error);
        throw error;
    }
};
