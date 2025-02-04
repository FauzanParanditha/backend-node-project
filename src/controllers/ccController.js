import logger from "../application/logger.js";
import * as ccService from "../service/ccService.js";
import { orderSchema } from "../validators/orderValidator.js";

export const createCreditCard = async (req, res, next) => {
    const partnerId = req.partnerId;
    try {
        // Validate request payload
        const validatedProduct = await orderSchema.validateAsync(req.body, {
            abortEarly: false,
        });

        const { response, result } = await ccService.createCC({ validatedProduct, partnerId });

        // Respond with created order details
        res.status(200).json({
            success: true,
            paymentLink: response.data.paymentActions.payUrl,
            PaymentExpired: response.data.expiredTime,
            paymentId: response.data.merchantTradeNo,
            totalAmount: response.data.amount,
            storeId: response.data.storeId,
            orderId: result.clientId,
            id: result._id,
        });
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error creating cc: ${error.message}`);
        next(error);
    }
};

export const ccOrderStatus = async (req, res, next) => {
    const { id } = req.params;
    try {
        const { responseHeaders, response } = await ccService.ccOrderStatus({ id });

        // Respond
        res.set(responseHeaders).status(200).json(response.data);
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error fetching cc status: ${error.message}`);
        next(error);
    }
};
