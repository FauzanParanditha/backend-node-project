import uuid4 from "uuid4";
import User from "../models/userModel.js";
import { calculateTotal, validateOrderProducts } from "../utils/helper.js";
import {
  orderSchema,
  paymentSNAPSchema,
} from "../validators/orderValidator.js";
import {
  createSignature,
  deriveUUID8,
  generateCustomerNumber,
  generateMerchantTradeNo,
  generateRequestId,
  generateTimestamp,
  generateUUID12,
  merchantId,
  paylabsApiUrl,
  verifySignature,
} from "../service/paylabs.js";
import {
  validateCreateVASNAP,
  validatePaymentVASNAP,
  validateVaSNAPStatus,
} from "../validators/paymentValidator.js";
import axios from "axios";
import Order from "../models/orderModel.js";
import * as vaSnapService from "../service/vaSnapService.js";
import logger from "../application/logger.js";

export const createVASNAP = async (req, res) => {
  try {
    // Validate request payload
    const validatedProduct = await orderSchema.validateAsync(req.body, {
      abortEarly: false,
    });
    const vaSnap = await vaSnapService.createVASNAP({ validatedProduct });

    // Respond with created order details
    res.status(200).json({
      success: true,
      partnerServiceId:
        vaSnap.response.data.virtualAccountData.partnerServiceId,
      customerNo: vaSnap.response.data.virtualAccountData.customerNo,
      virtualAccountNo:
        vaSnap.response.data.virtualAccountData.virtualAccountNo,
      totalAmount: vaSnap.response.data.virtualAccountData.totalAmount.value,
      paymentExpired: vaSnap.response.data.virtualAccountData.expiredDate,
      paymentId: vaSnap.response.data.virtualAccountData.trxId,
      orderId: vaSnap.result._id,
    });
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error creating va snap: ${error.message}`);
    return res.status(500).json({
      success: false,
      status: error.status,
      message: "An error occurred",
      error: error.response.data
        ? `error: ${error.response.data.responseMessage} with code ${error.response.data.responseCode}`
        : error.message,
    });
  }
};

export const vaSNAPOrderStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const vaSnap = await vaSnapService.vaSNAPOrderStatus({ id });
    // Respond
    res.set(vaSnap.responseHeaders).status(200).json(vaSnap.response.data);
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error fetching va snap status: ${error.message}`);
    return res.status(500).json({
      success: false,
      status: error.status,
      message: "An error occurred",
      error: error.response.data
        ? `error: ${error.response.data.responseMessage} with code ${error.response.data.responseCode}`
        : error.message,
    });
  }
};

export const VaSnapCallback = async (req, res) => {
  try {
    // Extract and verify signature
    const { "x-signature": signature, "x-timestamp": timestamp } = req.headers;
    const { body: payload, method: httpMethod } = req;

    const endpointUrl = "/transfer-va/payment";
    if (
      !verifySignature(httpMethod, endpointUrl, payload, timestamp, signature)
    ) {
      return res.status(401).send("Invalid signature");
    }

    const vaSnap = await vaSnapService.VaSnapCallback({ payload });

    // Respond
    res.set(vaSnap.responseHeaders).status(200).json(vaSnap.payloadResponse);
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error handling webhook va snap: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "An error occurred",
      error: error.message,
    });
  }
};

export const updateVASNAP = async (req, res) => {
  const { id } = req.params;
  try {
    const vaSnap = await vaSnapService.updateVASNAP({ id });
    // Send a response with the updated order details
    res.status(200).json({
      success: true,
      partnerServiceId:
        vaSnap.response.data.virtualAccountData.partnerServiceId,
      customerNo: vaSnap.response.data.virtualAccountData.customerNo,
      virtualAccountNo:
        vaSnap.response.data.virtualAccountData.virtualAccountNo,
      totalAmount: vaSnap.response.data.virtualAccountData.totalAmount.value,
      expiredDate: vaSnap.response.data.virtualAccountData.expiredDate,
      paymentId: vaSnap.response.data.virtualAccountData.trxId,
      orderId: id,
    });
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error update va snap: ${error.message}`);
    return res.status(500).json({
      success: false,
      status: error.status,
      message: "An error occurred",
      error: error.response.data
        ? `error: ${error.response.data.responseMessage} with code ${error.response.data.responseCode}`
        : error.message,
    });
  }
};
