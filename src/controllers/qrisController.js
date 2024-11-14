import uuid4 from "uuid4";
import User from "../models/userModel.js";
import { calculateTotal, validateOrderProducts } from "../utils/helper.js";
import {
  createSignature,
  generateHeaders,
  generateMerchantTradeNo,
  generateRequestId,
  generateTimestamp,
  merchantId,
  paylabsApiUrl,
} from "../service/paylabs.js";
import { orderSchema } from "../validators/orderValidator.js";
import {
  cancelQrisValidator,
  validateQrisRequest,
  validateQrisStatus,
} from "../validators/paymentValidator.js";
import axios from "axios";
import Order from "../models/orderModel.js";
import * as qrisService from "../service/qrisService.js";
import logger from "../application/logger.js";

export const createQris = async (req, res, next) => {
  try {
    // Validate request payload
    const validatedProduct = await orderSchema.validateAsync(req.body, {
      abortEarly: false,
    });
    const qris = await qrisService.createQris({ validatedProduct });
    // Respond with created order details
    res.status(200).json({
      success: true,
      qrCode: qris.response.data.qrCode,
      qrUrl: qris.response.data.qrisUrl,
      paymentExpired: qris.response.data.expiredTime,
      paymentId: qris.response.data.merchantTradeNo,
      totalAmount: qris.response.data.amount,
      storeId: qris.response.data.storeId,
      orderId: qris.result._id,
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
    const qris = await qrisService.qrisOrderStatus({ id });

    // Respond
    res.set(qris.responseHeaders).status(200).json(qris.response.data);
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error fetching qris status: ${error.message}`);
    next(error);
  }
};

export const cancleQris = async (req, res, next) => {
  const { id } = req.params;
  try {
    const qris = await qrisService.cancelQris({ id });

    if (
      qris.currentDateTime > qris.expiredDateTime &&
      qris.expiredDateTime != null
    ) {
      return res.status(200).json(qris.payloadResponseError);
    }
    // Respond with update order details
    res.set(qris.responseHeaders).status(200).json(qris.response.data);
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error cancel qris: ${error.message}`);
    next(error);
  }
};
