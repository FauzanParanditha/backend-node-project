import type { PaymentPartner } from "../types/express.js";
import axios from "axios";
import type { Request } from "express";
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


export const createVASNAP = async ({
    req,
    validatedProduct,
    partnerId,
}: {
    req: Request;
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

        const timestamp = generateTimestamp();
        const requestId = generateRequestId();
        const merchantTradeNo = generateMerchantTradeNo();
        const customerNo = generateCustomerNumber();

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
            expiredDate: generateTimestampSnap(300),
            additionalInfo: {
                paymentType: requestBodyForm.paymentType,
                ...(requestBodyForm.storeId && { storeId: requestBodyForm.storeId }),
            },
        };

        const { error } = validateCreateVASNAP(requestBody);
        if (error) {
            logger.error(
                "VASNAP request validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const signature = createSignature("POST", "/transfer-va/create-va", requestBody, timestamp);
        const clientIp = req.ip || "";
        const headers = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": timestamp,
            "X-PARTNER-ID": merchantId,
            "X-EXTERNAL-ID": requestId,
            "X-SIGNATURE": signature,
            "X-IP-ADDRESS": clientIp.includes("::ffff:") ? clientIp.split("::ffff:")[1] : clientIp,
        };

        const response = await axios.post(`${paylabsApiUrl}/api/v1.0/transfer-va/create-va`, requestBody, { headers });

        if (!response.data || response.data.responseCode.charAt(0) !== "2") {
            logger.error("Paylabs error: ", response.data ? response.data.responseMessage : "failed to create payment");
            throw new ResponseError(
                400,
                response.data
                    ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
                    : "failed to create payment",
            );
        }

        const result = await Order.create({
            ...requestBodyForm,
            totalAmount: response.data.virtualAccountData.totalAmount.value,
            partnerServiceId: response.data.virtualAccountData.partnerServiceId,
            paymentId: response.data.virtualAccountData.trxId,
            paymentExpired: response.data.virtualAccountData.expiredDate,
            customerNo: response.data.virtualAccountData.customerNo,
            virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
            storeId: response.data.virtualAccountData.additionalInfo.storeId,
            vaSnap: response.data,
        });

        logger.info("VASNAP created successfully");
        return { response, result };
    } catch (error) {
        logger.error("Error in createVASNAP: ", error);
        throw error;
    }
};

export const vaSNAPOrderStatus = async ({ id }: { id: string }) => {
    try {
        const existOrder = await Order.findById(id);
        if (!existOrder) {
            logger.error("Order does not exist: ", id);
            throw new ResponseError(404, "Order does not exist!");
        }

        const timestamp = generateTimestamp();
        const requestId = generateRequestId();

        const requestBody = {
            partnerServiceId: existOrder.partnerServiceId,
            customerNo: existOrder.customerNo,
            virtualAccountNo: existOrder.virtualAccountNo,
            inquiryRequestId: requestId,
            paymentRequestId: requestId,
        };

        const { error } = validateVaSNAPStatus(requestBody);
        if (error) {
            logger.error(
                "VASNAP status validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const signature = createSignature("POST", "/transfer-va/status", requestBody, timestamp);
        const headers = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": timestamp,
            "X-SIGNATURE": signature,
            "X-PARTNER-ID": merchantId,
            "X-REQUEST-ID": requestId,
        };

        const response = await axios.post(`${paylabsApiUrl}/api/v1.0/transfer-va/status`, requestBody, { headers });

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

        const responseHeaders = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": generateTimestamp(),
        };

        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in vaSNAPOrderStatus: ", error);
        throw error;
    }
};

export const VaSnapCallback = async ({ payload }: { payload: Record<string, any> }) => {
    try {
        const { error } = validatePaymentVASNAP(payload);
        if (error) {
            logger.error(
                "VASNAP callback validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const notificationData = payload;

        const trxId = notificationData.trxId;
        if (typeof trxId !== "string" || trxId.trim() === "") {
            throw new ResponseError(400, "Invalid transaction ID");
        }

        const sanitizedTrxId = trxId.trim();
        const existOrder = await Order.findOne({ paymentId: sanitizedTrxId });
        if (!existOrder) {
            logger.error("Order not found for orderID: ", notificationData.trxId);
            throw new ResponseError(404, `Order not found for orderID: ${notificationData.trxId}`);
        }

        const vaSnapData = existOrder.vaSnap as Record<string, any>;
        const currentDateTime = new Date();
        const expiredDateTime = new Date(vaSnapData.virtualAccountData.expiredDate);

        const responseHeaders = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": generateTimestampSnap(),
        };

        existOrder.paymentPaylabsVaSnap = { ...notificationData } as unknown as (typeof existOrder.paymentPaylabsVaSnap);

        const generateResponsePayload = (order: any, statusCode: string, statusMessage: string) => ({
            responseCode: statusCode || "2002500",
            responseMessage: statusMessage || "Success",
            virtualAccountData: {
                partnerServiceId: order.partnerServiceId,
                customerNo: order.paymentPaylabsVaSnap.customerNo,
                virtualAccountNo: order.paymentPaylabsVaSnap.virtualAccountNo,
                virtualAccountName: order.paymentPaylabsVaSnap.virtualAccountName,
                paymentRequestId: generateRequestId(),
            },
        });

        const payloadResponse = generateResponsePayload(existOrder, "2002500", "Success");

        if (existOrder.paymentStatus === "paid") {
            logger.info(`Order ${trxId} already paid, skipping processing`);
            return {
                responseHeaders,
                payloadResponse,
            };
        }

        existOrder.paymentStatus = "paid";
        existOrder.totalAmount = notificationData.paidAmount.value;
        existOrder.vaSnap = undefined;
        await existOrder.save();

        broadcastPaymentUpdate({ paymentId: sanitizedTrxId, status: "paid" });

        if (currentDateTime > expiredDateTime) {
            existOrder.paymentStatus = "expired";
            await existOrder.save();

            broadcastPaymentUpdate({ paymentId: sanitizedTrxId, status: "expired" });

            const payloadResponseError = generateResponsePayload(existOrder, "4030000", "Expired");
            return {
                responseHeaders,
                currentDateTime,
                expiredDateTime,
                payloadResponseError,
            };
        }

        return { responseHeaders, payloadResponse };
    } catch (error) {
        logger.error("Error in VaSnapCallback: ", error);
        throw error;
    }
};

export const updateVASNAP = async ({
    id,
    validatedUpdateData,
    req,
}: {
    id: string;
    validatedUpdateData: Record<string, any>;
    req: Request;
}) => {
    try {
        const existingOrder = await Order.findById(id);
        if (!existingOrder) {
            logger.error("Order does not exist: ", id);
            throw new ResponseError(404, "Order does not exist!");
        }

        if (existingOrder.paymentStatus === "paid") {
            logger.error("Payment already processed for order: ", id);
            throw new ResponseError(409, "Payment already processed!");
        }

        const currentDateTime = new Date();
        const expiredDateTime = new Date(existingOrder.paymentExpired as string);

        if (currentDateTime > expiredDateTime) {
            existingOrder.paymentStatus = "expired";
            await existingOrder.save();
            return { currentDateTime, expiredDateTime };
        }

        if (!existingOrder.vaSnap) {
            logger.error("VASNAP data not found in the order: ", id);
            throw new ResponseError(409, "Payment already processed!");
        }

        const existUser = await Client.findOne({ clientId: existingOrder.clientId });
        if (!existUser) {
            logger.error("Client does not exist for order: ", id);
            throw new ResponseError(404, "Client does not exist!");
        }

        const { validProducts, itemsForDb, totalAmount } = await validateOrderProducts(
            validatedUpdateData.items,
            validatedUpdateData.paymentType || undefined,
            validatedUpdateData.totalAmount,
        );
        if (!validProducts.length) {
            logger.error("No valid products found to update the order");
            throw new ResponseError(404, "No valid products found to create the order");
        }

        const vaSnapData = existingOrder.vaSnap as Record<string, any>;
        const updatedOrderData: Record<string, any> = {
            ...(existingOrder.toObject()),
            ...validatedUpdateData,
            totalAmount,
            paymentStatus: validatedUpdateData.paymentStatus || existingOrder.paymentStatus,
        };

        const newExpired = addMinutesToTimestamp(existingOrder.paymentExpired as string, 30);

        const timestamp = generateTimestamp();
        const requestId = uuid4();
        const requestBody = {
            partnerServiceId: vaSnapData.virtualAccountData.partnerServiceId,
            customerNo: vaSnapData.virtualAccountData.customerNo,
            virtualAccountNo: vaSnapData.virtualAccountData.virtualAccountNo,
            virtualAccountName: vaSnapData.virtualAccountData.virtualAccountName,
            virtualAccountEmail: (existUser as unknown as Record<string, unknown>).email as string,
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

        const { error } = validateCreateVASNAP(requestBody);
        if (error) {
            logger.error(
                "VASNAP update request validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const signature = createSignature("POST", "/transfer-va/update-va", requestBody, timestamp);
        const clientIp = req.ip || "";
        const headers = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": timestamp,
            "X-PARTNER-ID": merchantId,
            "X-EXTERNAL-ID": requestId,
            "X-SIGNATURE": signature,
            "X-IP-ADDRESS": clientIp.includes("::ffff:") ? clientIp.split("::ffff:")[1] : clientIp,
        };

        const response = await axios.post(`${paylabsApiUrl}/api/v1.0/transfer-va/update-va`, requestBody, { headers });

        if (!response.data || response.data.responseCode.charAt(0) !== "2") {
            logger.error("Paylabs error: ", response.data ? response.data.responseMessage : "failed to update payment");
            throw new ResponseError(
                400,
                response.data
                    ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
                    : "failed to update payment",
            );
        }

        updatedOrderData.items = itemsForDb;
        updatedOrderData.vaSnap = response.data;
        updatedOrderData.partnerServiceId = response.data.virtualAccountData.partnerServiceId;
        updatedOrderData.paymentId = response.data.virtualAccountData.trxId;
        updatedOrderData.paymentExpired = response.data.virtualAccountData.expiredDate;
        updatedOrderData.customerNo = response.data.virtualAccountData.customerNo;
        updatedOrderData.virtualAccountNo = response.data.virtualAccountData.virtualAccountNo;

        await Order.findByIdAndUpdate(id, updatedOrderData, { new: true });

        return { response };
    } catch (error) {
        logger.error("Error in updateVASNAP: ", error);
        throw error;
    }
};

export const deleteVASNAP = async ({ id, req }: { id: string; req: Request }) => {
    try {
        const existingOrder = await Order.findById(id);
        if (!existingOrder) {
            logger.error("Order does not exist: ", id);
            throw new ResponseError(404, "Order does not exist!");
        }

        if (existingOrder.paymentStatus === "paid") {
            logger.error("Payment already processed for order: ", id);
            throw new ResponseError(409, "Payment already processed!");
        }

        const currentDateTime = new Date();
        const expiredDateTime = new Date(existingOrder.paymentExpired as string);

        if (currentDateTime > expiredDateTime) {
            existingOrder.paymentStatus = "expired";
            await existingOrder.save();
            return { currentDateTime, expiredDateTime };
        }

        if (!existingOrder.vaSnap) {
            logger.error("VASNAP data not found in the order: ", id);
            throw new ResponseError(409, "Payment already processed!");
        }

        const vaSnapData = existingOrder.vaSnap as Record<string, any>;
        const timestamp = generateTimestamp();
        const requestId = uuid4();
        const requestBody = {
            partnerServiceId: vaSnapData.virtualAccountData.partnerServiceId,
            customerNo: vaSnapData.virtualAccountData.customerNo,
            virtualAccountNo: vaSnapData.virtualAccountData.virtualAccountNo,
            trxId: existingOrder.paymentId,
        };

        const { error } = validatedeleteVASNAP(requestBody);
        if (error) {
            logger.error(
                "VASNAP delete request validation failed: ",
                error.details.map((err: Record<string, any>) => err.message),
            );
            throw new ResponseError(400, error.details.map((err: Record<string, any>) => err.message).join(", "));
        }

        const signature = createSignature("POST", "/transfer-va/delete-va", requestBody, timestamp);
        const clientIp = req.ip || "";
        const headers = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": timestamp,
            "X-PARTNER-ID": merchantId,
            "X-EXTERNAL-ID": requestId,
            "X-SIGNATURE": signature,
            "X-IP-ADDRESS": clientIp.includes("::ffff:") ? clientIp.split("::ffff:")[1] : clientIp,
        };

        const response = await axios.post(`${paylabsApiUrl}/api/v1.0/transfer-va/delete-va`, requestBody, { headers });

        if (!response.data || response.data.responseCode.charAt(0) !== "2") {
            logger.error("Paylabs error: ", response.data ? response.data.responseMessage : "failed to delete payment");
            throw new ResponseError(
                400,
                response.data
                    ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
                    : "failed to delete payment",
            );
        }

        existingOrder.paymentStatus = "cancel";
        existingOrder.vaSnapDelete = response.data;
        await existingOrder.save();

        const responseHeaders = {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": timestamp,
        };

        return { response, responseHeaders };
    } catch (error) {
        logger.error("Error in deleteVASNAP: ", error);
        throw error;
    }
};
