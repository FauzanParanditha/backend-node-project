import axios from "axios";
import uuid4 from "uuid4";
import logger from "../application/logger.js";
import { broadcastPaymentUpdate } from "../application/websocket_server.js";
import { ResponseError } from "../error/responseError.js";
import Client from "../models/clientModel.js";
import Order from "../models/orderModel.js";
import { generateOrderId, validateOrderProducts } from "../utils/helper.js";
import {
    validateCreateVASNAP,
    validatedeleteVASNAP,
    validatePaymentVASNAP,
    validateVaSNAPStatus,
} from "../validators/paymentValidator.js";
import {
    addMinutesToTimestamp,
    createSignature,
    generateCustomerNumber,
    generateMerchantTradeNo,
    generateRequestId,
    generateTimestamp,
    generateTimestampSnap,
    merchantId,
    paylabsApiUrl,
} from "./paylabs.js";

export const createVASNAP = async ({ req, validatedProduct, partnerId }) => {
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
        const timestamp = generateTimestamp();
        const requestId = generateRequestId();
        const merchantTradeNo = generateMerchantTradeNo();
        const customerNo = generateCustomerNumber();

        // Prepare Paylabs request payload
        const requestBody = {
            partnerServiceId: `  ${merchantId}`,
            customerNo,
            virtualAccountNo: `${merchantId}${customerNo}`,
            virtualAccountName: requestBodyForm.payer,
            virtualAccountPhone: requestBodyForm.phoneNumber,
            trxId: merchantTradeNo,
            totalAmount: {
                value: String(requestBodyForm.totalAmount),
                currency: "IDR",
            },
            expiredDate: generateTimestampSnap(300), // 300 minutes
            additionalInfo: {
                paymentType: requestBodyForm.paymentType,
            },
        };

        // Validate requestBody
        const { error } = validateCreateVASNAP(requestBody);
        if (error) {
            logger.error(
                "VASNAP request validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate signature and headers
        const signature = createSignature("POST", "/transfer-va/create-va", requestBody, timestamp);
        const headers = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": timestamp,
            "X-PARTNER-ID": merchantId,
            "X-EXTERNAL-ID": requestId,
            "X-SIGNATURE": signature,
            "X-IP-ADDRESS": req.ip.includes("::ffff:") ? req.ip.split("::ffff:")[1] : req.ip,
        };

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/api/v1.0/transfer-va/create-va`, requestBody, { headers });

        // Check for successful response
        if (!response.data || response.data.responseCode.charAt(0) !== "2") {
            logger.error("Paylabs error: ", response.data ? response.data.responseMessage : "failed to create payment");
            throw new ResponseError(
                400,
                response.data
                    ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
                    : "failed to create payment",
            );
        }

        // Save order details in the database
        const result = await Order.create({
            ...requestBodyForm,
            totalAmount: response.data.virtualAccountData.totalAmount.value,
            partnerServiceId: response.data.virtualAccountData.partnerServiceId,
            paymentId: response.data.virtualAccountData.trxId,
            paymentExpired: response.data.virtualAccountData.expiredDate,
            customerNo: response.data.virtualAccountData.customerNo,
            virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
            vaSnap: response.data,
        });

        logger.info("VASNAP created successfully");
        return { response, result };
    } catch (error) {
        logger.error("Error in createVASNAP: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const vaSNAPOrderStatus = async ({ id }) => {
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

        // if (existOrder.paymentStatus === "expired") {
        //     logger.error("Payment already expired for order: ", id);
        //     throw new ResponseError(408, "Payment already processed!");
        // }

        // if (!existOrder.vaSnap) {
        //     logger.error("VASNAP data not found in the order: ", id);
        //     throw new ResponseError(400, "VASNAP data not found in the order");
        // }

        // Prepare request payload for Paylabs
        const timestamp = generateTimestamp();
        const requestId = generateRequestId();

        const requestBody = {
            partnerServiceId: existOrder.partnerServiceId,
            customerNo: existOrder.customerNo,
            virtualAccountNo: existOrder.virtualAccountNo,
            inquiryRequestId: requestId,
            paymentRequestId: requestId,
            // additionalInfo: existOrder.vaSnap.virtualAccountData.additionalInfo,
        };

        // Validate requestBody
        const { error } = validateVaSNAPStatus(requestBody);
        if (error) {
            logger.error(
                "VASNAP status validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate signature and headers
        const signature = createSignature("POST", "/transfer-va/status", requestBody, timestamp);
        const headers = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": timestamp,
            "X-SIGNATURE": signature,
            "X-PARTNER-ID": merchantId,
            "X-REQUEST-ID": requestId,
        };

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/api/v1.0/transfer-va/status`, requestBody, { headers });

        // Check for successful response
        if (!response.data || response.data.responseCode.charAt(0) !== "2") {
            logger.error(
                "Paylabs error: ",
                response.data ? response.data.responseMessage : "failed to query payment status",
            );
            throw new ResponseError(
                400,
                response.data
                    ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
                    : "failed to query payment status",
            );
        }

        // Prepare response payload and headers
        const responseHeaders = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": generateTimestamp(),
        };

        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in vaSNAPOrderStatus: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const VaSnapCallback = async ({ payload }) => {
    try {
        const { error } = validatePaymentVASNAP(payload);
        if (error) {
            logger.error(
                "VASNAP callback validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Retrieve notification data and order
        const notificationData = payload;

        // Validate transaction ID
        const trxId = notificationData.trxId;
        if (typeof trxId !== "string" || trxId.trim() === "") {
            throw new ResponseError(400, "Invalid transaction ID");
        }

        // Sanitize and query database
        const sanitizedTrxId = trxId.trim();
        const existOrder = await Order.findOne({ paymentId: sanitizedTrxId });
        if (!existOrder) {
            logger.error("Order not found for orderID: ", notificationData.trxId);
            throw new ResponseError(404, `Order not found for orderID: ${notificationData.trxId}`);
        }

        // if (existOrder.paymentStatus === "paid") {
        //     logger.error("Payment already processed for order: ", notificationData.trxId);
        //     throw new ResponseError(409, "Payment already processed!");
        // }

        const currentDateTime = new Date();
        const expiredDateTime = new Date(existOrder.vaSnap.virtualAccountData.expiredDate);

        // Update order details in the database
        existOrder.paymentStatus = "paid";
        existOrder.totalAmount = notificationData.paidAmount.value;
        existOrder.paymentPaylabsVaSnap = { ...notificationData };
        existOrder.vaSnap = undefined; // Clear VA snap data
        await existOrder.save();

        // Broadcast the payment update to all connected clients
        broadcastPaymentUpdate({ paymentId: sanitizedTrxId, status: "paid" });

        // Prepare response payload and headers
        const responseHeaders = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": generateTimestampSnap(),
        };

        const generateResponsePayload = (existOrder, statusCode, statusMessage) => ({
            responseCode: statusCode || "2002500",
            responseMessage: statusMessage || "Success",
            virtualAccountData: {
                partnerServiceId: existOrder.partnerServiceId,
                customerNo: existOrder.paymentPaylabsVaSnap.customerNo,
                virtualAccountNo: existOrder.paymentPaylabsVaSnap.virtualAccountNo,
                virtualAccountName: existOrder.paymentPaylabsVaSnap.virtualAccountName,
                paymentRequestId: generateRequestId(),
            },
        });

        if (currentDateTime > expiredDateTime) {
            existOrder.paymentStatus = "expired";
            await existOrder.save();

            // Broadcast the payment update to all connected clients
            broadcastPaymentUpdate({ paymentId: sanitizedTrxId, status: "expired" });

            const payloadResponseError = generateResponsePayload(existOrder, "4030000", "Expired");
            return {
                responseHeaders,
                currentDateTime,
                expiredDateTime,
                payloadResponseError,
            };
        }

        const payloadResponse = generateResponsePayload(existOrder, "2002500", "Success");
        return { responseHeaders, payloadResponse };
    } catch (error) {
        logger.error("Error in VaSnapCallback: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const updateVASNAP = async ({ id, validatedUpdateData, req }) => {
    try {
        // Check if the order exists
        const existingOrder = await Order.findById(id);
        if (!existingOrder) {
            logger.error("Order does not exist: ", id);
            throw new ResponseError(404, "Order does not exist!");
        }

        if (existingOrder.paymentStatus === "paid") {
            logger.error("Payment already processed for order: ", id);
            throw new ResponseError(409, "Payment already processed!");
        }

        // Check if the order has expired
        const currentDateTime = new Date();
        const expiredDateTime = new Date(existingOrder.paymentExpired);

        if (currentDateTime > expiredDateTime) {
            existingOrder.paymentStatus = "expired";
            await existingOrder.save();
            return { currentDateTime, expiredDateTime };
        }

        if (!existingOrder.vaSnap) {
            logger.error("VASNAP data not found in the order: ", id);
            throw new ResponseError(409, "Payment already processed!");
        }

        // Check if the user exists
        const existUser = await Client.findOne({ clientId: existingOrder.clientId });
        if (!existUser) {
            logger.error("Client does not exist for order: ", id);
            throw new ResponseError(404, "Client does not exist!");
        }

        // Validate products in the order
        const { validProducts, totalAmount } = await validateOrderProducts(
            validatedUpdateData.items,
            validatedUpdateData.paymentType || undefined,
            validatedUpdateData.totalAmount,
        );
        if (!validProducts.length) {
            logger.error("No valid products found to update the order");
            throw new ResponseError(404, "No valid products found to create the order");
        }

        // Update order details
        const updatedOrderData = {
            ...existingOrder._doc,
            ...validatedUpdateData,
            totalAmount,
            paymentStatus: validatedUpdateData.paymentStatus || existingOrder.paymentStatus,
        };

        const newExpired = addMinutesToTimestamp(existingOrder.paymentExpired, 30);

        // Prepare request payload for Paylabs
        const timestamp = generateTimestamp();
        const requestId = uuid4();
        const requestBody = {
            partnerServiceId: existingOrder.vaSnap.virtualAccountData.partnerServiceId,
            customerNo: existingOrder.vaSnap.virtualAccountData.customerNo,
            virtualAccountNo: existingOrder.vaSnap.virtualAccountData.virtualAccountNo,
            virtualAccountName: existingOrder.vaSnap.virtualAccountData.virtualAccountName,
            virtualAccountEmail: existUser.email,
            virtualAccountPhone: updatedOrderData.phoneNumber,
            trxId: generateMerchantTradeNo(),
            totalAmount: {
                value: String(updatedOrderData.totalAmount),
                currency: "IDR",
            },
            expiredDate: newExpired,
            additionalInfo: {
                paymentType: updatedOrderData.paymentType,
            },
        };

        // Validate requestBody
        const { error } = validateCreateVASNAP(requestBody);
        if (error) {
            logger.error(
                "VASNAP update request validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate signature and headers
        const signature = createSignature("POST", "/transfer-va/update-va", requestBody, timestamp);
        const headers = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": timestamp,
            "X-PARTNER-ID": merchantId,
            "X-EXTERNAL-ID": requestId,
            "X-SIGNATURE": signature,
            "X-IP-ADDRESS": req.ip.includes("::ffff:") ? req.ip.split("::ffff:")[1] : req.ip,
        };

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/api/v1.0/transfer-va/update-va`, requestBody, { headers });

        // Check for successful response
        if (!response.data || response.data.responseCode.charAt(0) !== "2") {
            logger.error("Paylabs error: ", response.data ? response.data.responseMessage : "failed to update payment");
            throw new ResponseError(
                400,
                response.data
                    ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
                    : "failed to update payment",
            );
        }

        // Update validatedUpdateData with validProducts
        updatedOrderData.items = validProducts;
        updatedOrderData.vaSnap = response.data;
        updatedOrderData.partnerServiceId = response.data.virtualAccountData.partnerServiceId;
        updatedOrderData.paymentId = response.data.virtualAccountData.trxId;
        updatedOrderData.paymentExpired = response.data.virtualAccountData.expiredDate;
        updatedOrderData.customerNo = response.data.virtualAccountData.customerNo;
        updatedOrderData.virtualAccountNo = response.data.virtualAccountData.virtualAccountNo;

        // Update order in the database
        await Order.findByIdAndUpdate(id, updatedOrderData, { new: true });

        return { response };
    } catch (error) {
        logger.error("Error in updateVASNAP: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const deleteVASNAP = async ({ id, validatedUpdateData, req }) => {
    try {
        // Check if the order exists
        const existingOrder = await Order.findById(id);
        if (!existingOrder) {
            logger.error("Order does not exist: ", id);
            throw new ResponseError(404, "Order does not exist!");
        }

        if (existingOrder.paymentStatus === "paid") {
            logger.error("Payment already processed for order: ", id);
            throw new ResponseError(409, "Payment already processed!");
        }

        // Check if the order has expired
        const currentDateTime = new Date();
        const expiredDateTime = new Date(existingOrder.paymentExpired);

        if (currentDateTime > expiredDateTime) {
            existingOrder.paymentStatus = "expired";
            await existingOrder.save();
            return { currentDateTime, expiredDateTime };
        }

        if (!existingOrder.vaSnap) {
            logger.error("VASNAP data not found in the order: ", id);
            throw new ResponseError(409, "Payment already processed!");
        }

        // Prepare request payload for Paylabs
        const timestamp = generateTimestamp();
        const requestId = uuid4();
        const requestBody = {
            partnerServiceId: existingOrder.vaSnap.virtualAccountData.partnerServiceId,
            customerNo: existingOrder.vaSnap.virtualAccountData.customerNo,
            virtualAccountNo: existingOrder.vaSnap.virtualAccountData.virtualAccountNo,
            trxId: existingOrder.paymentId,
        };

        // Validate requestBody
        const { error } = validatedeleteVASNAP(requestBody);
        if (error) {
            logger.error(
                "VASNAP delete request validation failed: ",
                error.details.map((err) => err.message),
            );
            throw new ResponseError(
                400,
                error.details.map((err) => err.message),
            );
        }

        // Generate signature and headers
        const signature = createSignature("POST", "/transfer-va/delete-va", requestBody, timestamp);
        const headers = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": timestamp,
            "X-PARTNER-ID": merchantId,
            "X-EXTERNAL-ID": requestId,
            "X-SIGNATURE": signature,
            "X-IP-ADDRESS": req.ip.includes("::ffff:") ? req.ip.split("::ffff:")[1] : req.ip,
        };

        // Send request to Paylabs
        const response = await axios.post(`${paylabsApiUrl}/api/v1.0/transfer-va/delete-va`, requestBody, { headers });

        // Check for successful response
        if (!response.data || response.data.responseCode.charAt(0) !== "2") {
            logger.error("Paylabs error: ", response.data ? response.data.responseMessage : "failed to delete payment");
            throw new ResponseError(
                400,
                response.data
                    ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
                    : "failed to delete payment",
            );
        }

        // Update order details in the database
        existingOrder.paymentStatus = "cancel";
        existingOrder.vaSnapDelete = response.data;
        await existingOrder.save();

        // Generate headers for Paylabs request
        const responseHeaders = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": timestamp,
        };

        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in deleteVASNAP: ", error);
        throw error; // Re-throw the error for further handling
    }
};
