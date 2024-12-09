import { orderSchema } from "../validators/orderValidator.js";
import * as qrisService from "../service/qrisService.js";
import logger from "../application/logger.js";
import { forwardCallback } from "../service/forwadCallback.js";

export const createQris = async (req, res, next) => {
    const partnerId = req.partnerId;
    try {
        // Validate request payload
        const validatedProduct = await orderSchema.validateAsync(req.body, {
            abortEarly: false,
        });
        const { response, result } = await qrisService.createQris({
            validatedProduct,
            partnerId,
        });
        // Respond with created order details
        res.status(200).json({
            success: true,
            qrCode: response.data.qrCode,
            qrUrl: response.data.qrisUrl,
            paymentExpired: response.data.expiredTime,
            paymentId: response.data.merchantTradeNo,
            totalAmount: response.data.amount,
            storeId: response.data.storeId,
            orderId: result._id,
        });
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error creating qris: ${error.message}`);
        next(error);
    }
};

export const qrisOrderStatus = async (req, res, next) => {
    const { id } = req.params;
    try {
        const { responseHeaders, response } = await qrisService.qrisOrderStatus({
            id,
        });

        // Respond
        res.set(responseHeaders).status(200).json(response.data);
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error fetching qris status: ${error.message}`);
        next(error);
    }
};

export const cancleQris = async (req, res, next) => {
    const { id } = req.params;
    try {
        const { currentDateTime, expiredDateTime, payloadResponseError, responseHeaders, response } =
            await qrisService.cancelQris({ id });

        if (currentDateTime > expiredDateTime && expiredDateTime != null) {
            return res.status(200).json(payloadResponseError);
        }
        // Respond with update order details
        res.set(responseHeaders).status(200).json(response.data);

        const payload = response.data;
        await forwardCallback({ payload });
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error cancel qris: ${error.message}`);
        next(error);
    }
};
