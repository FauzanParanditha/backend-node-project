import { orderSchema, vaStaticSchema } from "../validators/orderValidator.js";
import * as vaService from "../service/vaService.js";
import logger from "../application/logger.js";

export const createVA = async (req, res, next) => {
    try {
        // Validate request payload
        const validatedProduct = await orderSchema.validateAsync(req.body, {
            abortEarly: false,
        });

        const { response, result } = await vaService.createVa({ validatedProduct });

        // Respond with created order details
        res.status(200).json({
            success: true,
            virtualAccountNo: response.data.vaCode,
            paymentExpired: response.data.expiredTime,
            paymentId: response.data.merchantTradeNo,
            totalAmount: response.data.amount,
            storeId: response.data.storeId,
            orderId: result._id,
        });
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error creating va: ${error.message}`);
        next(error);
    }
};

export const vaOrderStatus = async (req, res, next) => {
    const { id } = req.params;
    try {
        const { responseHeaders, response } = await vaService.vaOrderStatus({ id });

        // Respond
        res.set(responseHeaders).status(200).json(response.data);
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error fetching va status: ${error.message}`);
        next(error);
    }
};

export const createStaticVa = async (req, res, next) => {
    try {
        // Validate request payload
        const validatedProduct = await vaStaticSchema.validateAsync(req.body, {
            abortEarly: false,
        });

        const { response, result } = await vaService.createVaStatic({
            validatedProduct,
        });

        // Respond with created order details
        res.status(200).json({
            success: true,
            virtualAccountNo: response.data.vaCode,
            createTime: response.data.createTime,
            storeId: response.data.storeId,
            vaId: result._id,
        });
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error creating va static: ${error.message}`);
        next(error);
    }
};
