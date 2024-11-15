import uuid4 from "uuid4";
import User from "../models/userModel.js";
import { calculateTotal, validateOrderProducts } from "../utils/helper.js";
import { orderSchema, vaStaticSchema } from "../validators/orderValidator.js";
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
  validateGenerateVA,
  validateStaticVA,
  validateVaStatus,
} from "../validators/paymentValidator.js";
import axios from "axios";
import Order from "../models/orderModel.js";
import VirtualAccount from "../models/vaModel.js";
import * as vaService from "../service/vaService.js";
import logger from "../application/logger.js";

export const createVA = async (req, res, next) => {
  try {
    // Validate request payload
    const validatedProduct = await orderSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const va = await vaService.createVa({ validatedProduct });

    // Respond with created order details
    res.status(200).json({
      success: true,
      virtualAccountNo: va.response.data.vaCode,
      paymentExpired: va.response.data.expiredTime,
      paymentId: va.response.data.merchantTradeNo,
      totalAmount: va.response.data.amount,
      storeId: va.response.data.storeId,
      orderId: va.result._id,
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
    const va = await vaService.vaOrderStatus({ id });

    // Respond
    res.set(va.responseHeaders).status(200).json(va.response.data);
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

    const vaStatic = vaService.createVaStatic({ validatedProduct });

    // Respond with created order details
    res.status(200).json({
      success: true,
      virtualAccountNo: vaStatic.response.data.vaCode,
      createTime: vaStatic.response.data.createTime,
      storeId: vaStatic.response.data.storeId,
      vaId: vaStatic.result._id,
    });
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error creating va static: ${error.message}`);
    next(error);
  }
};
