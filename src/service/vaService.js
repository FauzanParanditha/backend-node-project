import axios from "axios";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import Order from "../models/orderModel.js";
import VirtualAccount from "../models/vaModel.js";
import { generateOrderId, validateOrderProducts } from "../utils/helper.js";
import { validateGenerateVA, validateStaticVA, validateVaStatus } from "../validators/paymentValidator.js";
import { generateHeaders, generateMerchantTradeNo, generateRequestId, merchantId, paylabsApiUrl } from "./paylabs.js";

export const createVa = async ({ validatedProduct, partnerId }) => {
    try {
        // Validate products in the order
        const { validProducts, totalAmount } = await validateOrderProducts(
            validatedProduct.items,
            validatedProduct.paymentType,
            validatedProduct.totalAmount,
        );
        if (!validProducts.length) {
            logger.error("No valid products found to create the order");
            throw new ResponseError(404, "No valid products found to create the order");
        }

        // Construct order data
        const requestBodyForm = {
            orderId: generateOrderId(partnerId.clientId),
            userId: validatedProduct.userId,
            items: validProducts,
            totalAmount,
            phoneNumber: validatedProduct.phoneNumber,
            paymentStatus: "pending",
            payer: partnerId.name,
            paymentMethod: validatedProduct.paymentMethod,
            paymentType: validatedProduct.paymentType,
            clientId: partnerId.clientId,
            ...(validatedProduct.storeId && { storeId: validatedProduct.storeId }),
        };

        // Generate IDs and other necessary fields
        const requestId = generateRequestId();
        const merchantTradeNo = generateMerchantTradeNo();

        // Prepare Paylabs request payload
        const requestBody = {
            requestId,
            merchantId,
            ...(requestBodyForm.storeId && { storeId: requestBodyForm.storeId }),
            paymentType: requestBodyForm.paymentType,
            amount: requestBodyForm.totalAmount,
            merchantTradeNo,
            notifyUrl: process.env.NOTIFY_URL,
            payer: requestBodyForm.payer,
            productName: requestBodyForm.items.map((p) => p.name).join(", "),
            productInfo: requestBodyForm.items.map((product) => ({
                id: product.id,
                name: product.name,
                price: product.price,
                type: product.type,
                quantity: product.quantity,
            })),
            feeType: "OUR",
        };

        // Validate requestBody
        const { error } = validateGenerateVA(requestBody);
        if (error) {
            logger.error(
                "VA request validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate headers for Paylabs request
        const { headers } = generateHeaders("POST", "/payment/v2.1/va/create", requestBody, requestId);

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/va/create`, requestBody, { headers });

        // Check for successful response
        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCode : "failed to create payment");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCode}` : "failed to create payment",
            );
        }

        // Save order details in the database
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
    } catch (error) {
        logger.error("Error in createVa: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const vaOrderStatus = async ({ id }) => {
    try {
        // Check if the order exists
        const existOrder = await Order.findById(id);
        if (!existOrder) {
            logger.error("Order does not exist: ", id);
            throw new ResponseError(404, "Order does not exist!");
        }

        // if (existOrder.paymentStatus === "paid") {
        //     logger.error("Payment already processed for order: ", id);
        //     throw new ResponseError(409, "Payment already processed!");
        // }

        if (existOrder.paymentStatus === "expired") {
            logger.error("Payment already expired for order: ", id);
            throw new ResponseError(408, "Payment already processed!");
        }

        // if (!existOrder.va) {
        //     logger.error("VA data not found in the order: ", id);
        //     throw new ResponseError(400, "VA data not found in the order");
        // }

        // Prepare request payload for Paylabs
        const requestId = generateRequestId();
        const requestBody = {
            requestId,
            merchantId,
            ...(existOrder.storeId && { storeId: existOrder.storeId }),
            merchantTradeNo: existOrder.paymentId,
            paymentType: existOrder.paymentType,
        };

        // Validate requestBody
        const { error } = validateVaStatus(requestBody);
        if (error) {
            logger.error(
                "VA status validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate headers for Paylabs request
        const { headers } = generateHeaders("POST", "/payment/v2.1/va/query", requestBody, requestId);

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/va/query`, requestBody, { headers });

        // Check for successful response
        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCode : "failed to query payment status");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCode}` : "failed to query payment status",
            );
        }

        // Generate headers for Paylabs request
        const { responseHeaders } = generateHeaders("POST", "/api/order/status/va/:id", response.data, requestId);

        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in vaOrderStatus: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const createVaStatic = async ({ validatedProduct, partnerId }) => {
    try {
        // Construct order data
        const requestBodyForm = {
            orderId: generateOrderId(partnerId.clientId),
            payer: partnerId.name,
            totalAmount: 0,
            phoneNumber: validatedProduct.phoneNumber,
            paymentStatus: "pending",
            paymentMethod: validatedProduct.paymentMethod,
            paymentType: validatedProduct.paymentType,
            clientId: partnerId.clientId,
            ...(validatedProduct.storeId && { storeId: validatedProduct.storeId }),
        };

        // Generate IDs and other necessary fields
        const requestId = generateRequestId();

        // Prepare Paylabs request payload
        const requestBody = {
            requestId,
            merchantId,
            ...(requestBodyForm.storeId && { storeId: requestBodyForm.storeId }),
            paymentType: requestBodyForm.paymentType,
            payer: requestBodyForm.payer,
            notifyUrl: `${process.env.NOTIFY_URL}/va`,
        };

        // Validate requestBody
        const { error } = validateStaticVA(requestBody);
        if (error) {
            logger.error(
                "Static VA request validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate headers for Paylabs request
        const { headers } = generateHeaders("POST", "/payment/v2.1/staticva/create", requestBody, requestId);

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/staticva/create`, requestBody, { headers });

        // Check for successful response
        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCode : "failed to create static VA");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCode}` : "failed to create static VA",
            );
        }

        // Save VA details in the database
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
        throw error; // Re-throw the error for further handling
    }
};
