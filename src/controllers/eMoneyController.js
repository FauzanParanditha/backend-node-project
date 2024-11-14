import uuid4 from "uuid4";
import User from "../models/userModel.js";
import { calculateTotal, validateOrderProducts } from "../utils/helper.js";
import { orderSchema, refundSchema } from "../validators/orderValidator.js";
import {
  createSignature,
  generateHeaders,
  generateMerchantTradeNo,
  generateRequestId,
  generateTimestamp,
  merchantId,
  paylabsApiUrl,
} from "../service/paylabs.js";
import {
  validateEMoneyRefund,
  validateEMoneyRequest,
  validateEmoneyStatus,
} from "../validators/paymentValidator.js";
import axios from "axios";
import Order from "../models/orderModel.js";
import * as eMoneyService from "../service/eMoneyService.js";
import logger from "../application/logger.js";

export const createEMoney = async (req, res, next) => {
  try {
    // Validate request payload
    const validatedProduct = await orderSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const eMoney = await eMoneyService.createEMoney({ validatedProduct });

    // Respond with created order details
    res.status(200).json({
      success: true,
      paymentActions: eMoney.response.data.paymentActions,
      paymentExpired: eMoney.response.data.expiredTime,
      paymentId: eMoney.response.data.merchantTradeNo,
      totalAmount: eMoney.response.data.amount,
      storeId: eMoney.response.data.storeId,
      orderId: eMoney.result._id,
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
    const eMoney = await eMoneyService.eMoneyOrderStatus({ id });
    // Respond
    res.set(eMoney.responseHeaders).status(200).json(eMoney.response.data);
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

    const eMoney = await eMoneyService.refundEmoney({ id, validatedRequest });
    // Respond
    res.set(eMoney.responseHeaders).status(200).json(eMoney.response.data);
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error refund e-money: ${error.message}`);
    next(error);
  }
};
