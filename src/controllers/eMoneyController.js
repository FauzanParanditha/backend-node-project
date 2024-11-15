import { orderSchema, refundSchema } from "../validators/orderValidator.js";
import * as eMoneyService from "../service/eMoneyService.js";
import logger from "../application/logger.js";

export const createEMoney = async (req, res, next) => {
  try {
    // Validate request payload
    const validatedProduct = await orderSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const { response, result } = await eMoneyService.createEMoney({
      validatedProduct,
    });

    // Respond with created order details
    res.status(200).json({
      success: true,
      paymentActions: response.data.paymentActions,
      paymentExpired: response.data.expiredTime,
      paymentId: response.data.merchantTradeNo,
      totalAmount: response.data.amount,
      storeId: response.data.storeId,
      orderId: result._id,
    });
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error creating e-money: ${error.message}`);
    next(error);
  }
};

export const eMoneyOrderStatus = async (req, res, next) => {
  const { id } = req.params;
  try {
    const { responseHeaders, response } = await eMoneyService.eMoneyOrderStatus(
      { id }
    );
    // Respond
    res.set(responseHeaders).status(200).json(response.data);
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error fetching e-money status: ${error.message}`);
    next(error);
  }
};

export const createEMoneyRefund = async (req, res, next) => {
  const { id } = req.params;
  try {
    // Validate request payload
    const validatedRequest = await refundSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const { responseHeaders, response } = await eMoneyService.refundEmoney({
      id,
      validatedRequest,
    });
    // Respond
    res.set(responseHeaders).status(200).json(response.data);
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error refund e-money: ${error.message}`);
    next(error);
  }
};
