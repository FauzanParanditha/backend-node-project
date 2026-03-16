import axios from "axios";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import Order from "../models/orderModel.js";
import VirtualAccount from "../models/vaModel.js";
import type { PaymentPartner } from "../types/express.js";
import { generateOrderId, validateOrderProducts } from "../utils/helper.js";
import { validateGenerateVA, validateStaticVA, validateVaStatus } from "../validators/paymentValidator.js";
import { sendPartnerApiErrorAlert } from "./discordService.js";
import { generateHeaders, generateMerchantTradeNo, generateRequestId, merchantId, paylabsApiUrl } from "./paylabs.js";

export const createVa = async ({
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
            payer: requestBodyForm.payer,
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

        logger.info("Request Body for VA Creation: ", requestBody);

        const { error } = validateGenerateVA(requestBody);
        if (error) {
            logger.error(
                "VA request validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const { headers } = generateHeaders("POST", "/payment/v2.1/va/create", requestBody, requestId);
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/va/create`, requestBody, { headers });

        if (!response.data || response.data.errCode !== "0") {
            const errMsg = response.data ? `error: ${response.data.errCode}` : "failed to create payment";
            logger.error(`Paylabs error: ${errMsg}`);
            sendPartnerApiErrorAlert("Paylabs (VA)", "/payment/v2.1/va/create", errMsg).catch(console.error);
            throw new ResponseError(400, errMsg);
        }

        const result = await Order.create({
            ...requestBodyForm,
            totalAmount: response.data.amount,
            virtualAccountNo: response.data.vaCode,
            paymentId: response.data.merchantTradeNo,
            paymentExpired: response.data.expiredTime,
            storeId: response.data.storeId,
            va: response.data,
        });

        logger.info("VA created successfully");
        return { response, result };
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            sendPartnerApiErrorAlert("Paylabs Network (VA)", "/payment/v2.1/va/create", error.message).catch(
                console.error,
            );
        }
        logger.error("Error in createVa: ", error);
        throw error;
    }
};

export const vaOrderStatus = async ({ id }: { id: string }) => {
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

        const { error } = validateVaStatus(requestBody);
        if (error) {
            logger.error(
                "VA status validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const { headers } = generateHeaders("POST", "/payment/v2.1/va/query", requestBody, requestId);
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/va/query`, requestBody, { headers });

        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCode : "failed to query payment status");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCode}` : "failed to query payment status",
            );
        }

        const { headers: responseHeaders } = generateHeaders(
            "POST",
            "/api/order/status/va/:id",
            response.data,
            requestId,
        );

        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in vaOrderStatus: ", error);
        throw error;
    }
};

export const createVaStatic = async ({
    validatedProduct,
    partnerId,
}: {
    validatedProduct: Record<string, any>;
    partnerId: PaymentPartner;
}) => {
    try {
        const requestBodyForm = {
            orderId: await generateOrderId(partnerId.clientId),
            payer: partnerId.name,
            totalAmount: 0,
            phoneNumber: validatedProduct.phoneNumber,
            paymentStatus: "pending",
            paymentMethod: validatedProduct.paymentMethod,
            paymentType: validatedProduct.paymentType,
            clientId: partnerId.clientId,
            ...(validatedProduct.storeId && { storeId: validatedProduct.storeId }),
        };

        const requestId = generateRequestId();

        const requestBody = {
            requestId,
            merchantId,
            ...(requestBodyForm.storeId && { storeId: requestBodyForm.storeId }),
            paymentType: requestBodyForm.paymentType,
            payer: requestBodyForm.payer,
            notifyUrl: `${process.env.NOTIFY_URL}/va`,
        };

        const { error } = validateStaticVA(requestBody);
        if (error) {
            logger.error(
                "Static VA request validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const { headers } = generateHeaders("POST", "/payment/v2.1/staticva/create", requestBody, requestId);
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/staticva/create`, requestBody, { headers });

        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCode : "failed to create static VA");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCode}` : "failed to create static VA",
            );
        }

        const result = await VirtualAccount.create({
            payer: requestBodyForm.payer,
            phoneNumber: requestBodyForm.phoneNumber,
            vaCode: response.data.vaCode,
            vaStatic: response.data,
            clientId: requestBodyForm.clientId,
        });

        logger.info("Static VA created successfully: ", result.id);
        return { response, result };
    } catch (error) {
        logger.error("Error in createVaStatic: ", error);
        throw error;
    }
};
