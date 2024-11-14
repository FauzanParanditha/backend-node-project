import { orderSchema } from "../validators/orderValidator.js";
import * as ccService from "../service/ccService.js";
import logger from "../application/logger.js";

export const createCreditCard = async (req, res) => {
  try {
    // Validate request payload
    const validatedProduct = await orderSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const cc = await ccService.createCC({ validatedProduct });

    // Respond with created order details
    res.status(200).json({
      success: true,
      paymentLink: cc.response.data.paymentActions.payUrl,
      PaymentExpired: cc.response.data.expiredTime,
      paymentId: cc.response.data.merchantTradeNo,
      totalAmount: cc.response.data.amount,
      storeId: cc.response.data.storeId,
      orderId: cc.result._id,
    });
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error creating cc: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "An error occurred",
      error: error.message,
    });
  }
};

export const ccOrderStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const cc = await ccService.ccOrderStatus({ id });

    // Respond
    res.set(cc.responseHeaders).status(200).json(cc.response.data);
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error fetching cc status: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "An error occurred",
      error: error.message,
    });
  }
};
