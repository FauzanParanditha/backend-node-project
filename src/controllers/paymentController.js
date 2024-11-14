import axios from "axios";
import {
  createSignature,
  generateHeaders,
  generateMerchantTradeNo,
  generateRequestId,
  generateTimestamp,
  merchantId,
  paylabsApiUrl,
  verifySignature,
} from "../service/paylabs.js";
import { validateCreateLinkRequest } from "../validators/paymentValidator.js";
import uuid4 from "uuid4";
import * as paymentService from "../service/paymentService.js";
import Order from "../models/orderModel.js";
import VirtualAccount from "../models/vaModel.js";
import logger from "../application/logger.js";

// Handle Paylabs callback notifications
export const paylabsCallback = async (req, res, next) => {
  try {
    // Extract and verify signature
    const { "x-signature": signature, "x-timestamp": timestamp } = req.headers;
    const { body: payload, method: httpMethod, originalUrl: endpointUrl } = req;

    if (
      !verifySignature(httpMethod, endpointUrl, payload, timestamp, signature)
    ) {
      return res.status(401).send("Invalid signature");
    }

    const callback = await paymentService.callbackPaylabs({ payload });

    res
      .set(callback.responseHeaders)
      .status(200)
      .json(callback.payloadResponse);
  } catch (error) {
    logger.error(`Error handling webhook: ${error.message}`);
    next(error);
  }
};

export const paylabsVaStaticCallback = async (req, res, next) => {
  try {
    // Extract and verify signature
    const { "x-signature": signature, "x-timestamp": timestamp } = req.headers;
    const { body: payload, method: httpMethod, originalUrl: endpointUrl } = req;

    if (
      !verifySignature(httpMethod, endpointUrl, payload, timestamp, signature)
    ) {
      return res.status(401).send("Invalid signature");
    }

    // Retrieve notification data and order
    const notificationData = payload;
    const va = await VirtualAccount.findOne({
      vaCode: notificationData.paymentMethodInfo.vaCode,
    });

    if (!va) {
      return res.status(404).json({
        success: false,
        message: `virtual account not found for vaCode: ${notificationData.paymentMethodInfo.vaCode}`,
      });
    }

    // Process based on notification status
    switch (notificationData.status) {
      case "02": // Payment successful
        await Order.create({
          orderId: uuid4(),
          userId: va.userId,
          totalAmount: notificationData.amount,
          phoneNumber: va.phoneNumber,
          paymentStatus: "paid",
          paymentMethod: "paylabs",
          paymentType: notificationData.paymentType,
          virtualAccountNo: notificationData.paymentMethodInfo.vaCode,
          paymentId: notificationData.merchantTradeNo,
          paymentPaylabs: { ...notificationData },
        });
        break;

      case "09": // Payment failed
        break;

      default:
        logger.error(
          `Unhandled notification status: ${notificationData.status}`
        );
        return res.status(400).json({
          success: false,
          message: "Unhandled notification status",
        });
    }

    // Prepare response payload and headers
    const timestampResponse = generateTimestamp();
    const responsePayload = {
      merchantId: process.env.PAYLABS_MERCHANT_ID,
      requestId: generateRequestId(),
      errCode: notificationData.errCode,
    };

    const signatureResponse = createSignature(
      "POST",
      "/api/order/webhook/paylabs/va",
      responsePayload,
      timestampResponse
    );

    const responseHeaders = {
      "Content-Type": "application/json;charset=utf-8",
      "X-TIMESTAMP": timestampResponse,
      "X-SIGNATURE": signatureResponse,
      "X-PARTNER-ID": process.env.PAYLABS_MERCHANT_ID,
      "X-REQUEST-ID": generateRequestId(),
    };

    res.set(responseHeaders).status(200).json(responsePayload);
  } catch (error) {
    logger.error(`Error handling webhook: ${error.message}`);
    next(error);
  }
};
