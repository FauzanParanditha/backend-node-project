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

    if (
      callback.currentDateTime > callback.expiredDateTime &&
      callback.expiredDateTime != null
    ) {
      return res.status(200).json(callback.payloadResponseError);
    }

    return res
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

    const callback = await paymentService.callbackPaylabsVaStatic({ payload });

    return res
      .set(callback.responseHeaders)
      .status(200)
      .json(callback.responsePayload);
  } catch (error) {
    logger.error(`Error handling webhook: ${error.message}`);
    next(error);
  }
};
