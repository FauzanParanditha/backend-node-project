import axios from "axios";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import Order from "../models/orderModel.js";
import { generateOrderId, validateOrderProducts } from "../utils/helper.js";
import { validateEMoneyRefund, validateEMoneyRequest, validateEmoneyStatus } from "../validators/paymentValidator.js";
import { generateHeaders, generateMerchantTradeNo, generateRequestId, merchantId, paylabsApiUrl } from "./paylabs.js";

export const createEMoney = async ({ validatedProduct, partnerId }) => {
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
            paymentParams: {
                redirectUrl: process.env.REDIRECT_URL,
                ...(requestBodyForm.paymentType === "OVOBALANCE" && {
                    phoneNumber: requestBodyForm.phoneNumber,
                }),
            },
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
        const { error } = validateEMoneyRequest(requestBody);
        if (error) {
            logger.error(
                "Validation error: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate headers for Paylabs request
        const { headers } = generateHeaders("POST", "/payment/v2.1/ewallet/create", requestBody, requestId);

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/ewallet/create`, requestBody, { headers });

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
        throw error; // Re-throw the error for further handling
    }
};

export const eMoneyOrderStatus = async ({ id }) => {
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
            logger.error("Payment expired for order: ", id);
            throw new ResponseError(408, "Payment already processed!");
        }

        // if (!existOrder.eMoney) {
        //     logger.error("E-Money data not found in the order: ", id);
        //     throw new ResponseError(400, "E-Money data not found in the order");
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
        const { error } = validateEmoneyStatus(requestBody);
        if (error) {
            logger.error(
                "Validation error: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate headers for Paylabs request
        const { headers } = generateHeaders("POST", "/payment/v2.1/ewallet/query", requestBody, requestId);

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/ewallet/query`, requestBody, { headers });

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

        // Generate headers for response
        const { responseHeaders } = generateHeaders(
            "POST",
            "/api/order/status/ewallet/:id",
            response.data,
            generateRequestId(),
        );

        logger.info("E-Money order status retrieved successfully: ", response.data);
        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in eMoneyOrderStatus: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const refundEmoney = async ({ id, validatedRequest }) => {
    try {
        // Check if the order exists
        const existOrder = await Order.findById(id);
        if (!existOrder) {
            logger.error("Order does not exist: ", id);
            throw new ResponseError(404, "Order does not exist!");
        }

        if (!existOrder.paymentPaylabs) {
            logger.error("Order not completed: ", id);
            throw new ResponseError(400, "Order does not completed!");
        }

        // Check if refund is supported for the payment type
        if (existOrder.paymentType === "OVOBALANCE") {
            logger.error("Refunds are not supported for OVOBALANCE payment type for order: ", id);
            throw new ResponseError(400, "Refunds are not supported for OVOBALANCE payment type.");
        }

        // Prepare request payload for Paylabs
        const requestId = generateRequestId();
        const refundNo = generateMerchantTradeNo();

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
            transFeeRate: existOrder.paymentPaylabs.transFeeRate,
            transFeeAmount: existOrder.paymentPaylabs.transFeeAmount,
            totalTransFee: existOrder.paymentPaylabs.totalTransFee,
        };

        // Validate requestBody
        const { error } = validateEMoneyRefund(requestBody);
        if (error) {
            logger.error(
                "Validation error: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate headers for Paylabs request
        const { headers } = generateHeaders("POST", "/payment/v2.1/ewallet/refund", requestBody, requestId);

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/ewallet/refund`, requestBody, { headers });

        // Check for successful response
        if (!response.data || response.data.errCode !== "0") {
            logger.error("Paylabs error: ", response.data ? response.data.errCodeDes : "failed to process refund");
            throw new ResponseError(
                400,
                response.data ? `error: ${response.data.errCodeDes}` : "failed to process refund",
            );
        }

        // Generate headers for response
        const { responseHeaders } = generateHeaders(
            "POST",
            "/api/order/refund/ewallet/:id",
            response.data,
            generateRequestId(),
        );

        logger.info("E-Money refund processed successfully: ", response.data);
        return { response, responseHeaders };
    } catch (error) {
        logger.error(`Error in refundEmoney: ${JSON.stringify(error.response.statusText)}`);
        throw error; // Re-throw the error for further handling
    }
};
