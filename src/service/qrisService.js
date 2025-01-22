import axios from "axios";
import uuid4 from "uuid4";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import Order from "../models/orderModel.js";
import { validateOrderProducts } from "../utils/helper.js";
import { cancelQrisValidator, validateQrisRequest, validateQrisStatus } from "../validators/paymentValidator.js";
import {
    convertToDate,
    generateHeaders,
    generateMerchantTradeNo,
    generateRequestId,
    merchantId,
    paylabsApiUrl,
} from "./paylabs.js";

export const createQris = async ({ validatedProduct, partnerId }) => {
    try {
        // Validate products in the order
        const { validProducts, totalAmount } = await validateOrderProducts(
            validatedProduct.items,
            validatedProduct.paymentType,
            validatedProduct.totalAmount,
        );
        if (!validProducts.length) {
            logger.error("No valid products found to create the order");
            throw new ResponseError(404, "No valid products found to update the order");
        }

        // Construct order data
        const requestBodyForm = {
            orderId: uuid4(),
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
            expire: 300,
            feeType: "OUR",
            productName: requestBodyForm.items.map((p) => p.name).join(", "),
            productInfo: requestBodyForm.items.map((product) => ({
                id: product.id,
                name: product.name,
                price: product.price,
                type: product.type,
                quantity: product.quantity,
            })),
        };

        // Validate requestBody
        const { error } = validateQrisRequest(requestBody);
        if (error) {
            logger.error(
                "QRIS request validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate headers for Paylabs request
        const { headers } = generateHeaders("POST", "/payment/v2.1/qris/create", requestBody, requestId);

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/qris/create`, requestBody, { headers });

        // Check for successful response
        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCodeDes : "failed to create payment");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCodeDes}` : "failed to create payment",
            );
        }

        // Save order details in the database
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
    } catch (error) {
        logger.error("Error in createQris: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const qrisOrderStatus = async ({ id }) => {
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

        // if (!existOrder.qris) {
        //     logger.error("QRIS data not found in the order: ", id);
        //     throw new ResponseError(400, "QRIS data not found in the order");
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
        const { error } = validateQrisStatus(requestBody);
        if (error) {
            logger.error(
                "QRIS status validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate headers for Paylabs request
        const { headers } = generateHeaders("POST", "/payment/v2.1/qris/query", requestBody, requestId);

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/qris/query`, requestBody, { headers });

        // Check for successful response
        if (!response.data || response.data.errCode !== "0") {
            logger.error(
                "Paylabs error: ",
                response.data ? response.data.errCodeDes : "failed to query payment status",
            );
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCodeDes}` : "failed to query payment status",
            );
        }

        // Generate headers for Paylabs request
        const { responseHeaders } = generateHeaders("POST", "/api/order/status/qris/:id", response.data, requestId);

        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in qrisOrderStatus: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const cancelQris = async ({ id }) => {
    try {
        // Check if the order exists
        const existOrder = await Order.findById(id);
        if (!existOrder) {
            logger.error("Order does not exist: ", id);
            throw new ResponseError(404, "Order does not exist!");
        }

        // Check if the order has expired
        const currentDateTime = new Date();
        const expiredDateTime = convertToDate(existOrder.paymentExpired);

        if (currentDateTime > expiredDateTime) {
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

        // Prepare request payload for Paylabs
        const requestId = generateRequestId();
        const requestBody = {
            requestId,
            merchantId,
            ...(existOrder.storeId && { storeId: existOrder.storeId }),
            merchantTradeNo: existOrder.paymentId,
            platformTradeNo: existOrder.qris.platformTradeNo,
            qrCode: existOrder.qris.qrCode,
        };

        // Validate requestBody
        const { error } = cancelQrisValidator(requestBody);
        if (error) {
            logger.error(
                "QRIS cancel validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate headers for Paylabs request
        const { headers } = generateHeaders("POST", "/payment/v2.1/qris/cancel", requestBody, requestId);

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/qris/cancel`, requestBody, { headers });

        // Check for successful response
        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCodeDes : "failed to cancel payment");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCodeDes}` : "failed to cancel payment",
            );
        }

        // Update order details in the database
        existOrder.paymentLink = undefined;
        existOrder.paymentStatus = "cancel";
        existOrder.qris.set(response.data);
        await existOrder.save();

        // Generate headers for Paylabs request
        const { responseHeaders } = generateHeaders(
            "POST",
            "/payment/v2.1/qris/cancel",
            response.data,
            generateRequestId(),
        );

        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in cancelQris: ", error);
        throw error; // Re-throw the error for further handling
    }
};
