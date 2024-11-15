import { orderSchema } from "../validators/orderValidator.js";
import { verifySignature } from "../service/paylabs.js";
import * as vaSnapService from "../service/vaSnapService.js";
import logger from "../application/logger.js";

export const createVASNAP = async (req, res) => {
  try {
    // Validate request payload
    const validatedProduct = await orderSchema.validateAsync(req.body, {
      abortEarly: false,
    });
    const { response, result } = await vaSnapService.createVASNAP({
      req,
      validatedProduct,
    });

    // Respond with created order details
    res.status(200).json({
      success: true,
      partnerServiceId: response.data.virtualAccountData.partnerServiceId,
      customerNo: response.data.virtualAccountData.customerNo,
      virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
      totalAmount: response.data.virtualAccountData.totalAmount.value,
      paymentExpired: response.data.virtualAccountData.expiredDate,
      paymentId: response.data.virtualAccountData.trxId,
      orderId: result._id,
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
    const { responseHeaders, response } = await vaSnapService.vaSNAPOrderStatus(
      { id }
    );
    // Respond
    res.set(responseHeaders).status(200).json(response.data);
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

export const VaSnapCallback = async (req, res, next) => {
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

    const {
      responseHeaders,
      payloadResponse,
      currentDateTime,
      expiredDateTime,
      payloadResponseError,
    } = await vaSnapService.VaSnapCallback({ payload });

    if (currentDateTime > expiredDateTime) {
      res.set(responseHeaders).status(403).json(payloadResponseError);
    }

    // Respond
    res.set(responseHeaders).status(200).json(payloadResponse);
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error handling webhook va snap: ${error.message}`);
    next(error);
  }
};

export const updateVASNAP = async (req, res) => {
  const { id } = req.params;
  try {
    // Validate the update payload
    const validatedUpdateData = await orderSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const { currentDateTime, expiredDateTime, response } =
      await vaSnapService.updateVASNAP({
        id,
        validatedUpdateData,
        req,
      });

    if (currentDateTime > expiredDateTime) {
      return res.status(200).json({
        success: true,
        message: "payment expired",
      });
    }
    // Send a response with the updated order details
    res.status(200).json({
      success: true,
      partnerServiceId: response.data.virtualAccountData.partnerServiceId,
      customerNo: response.data.virtualAccountData.customerNo,
      virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
      totalAmount: response.data.virtualAccountData.totalAmount.value,
      expiredDate: response.data.virtualAccountData.expiredDate,
      paymentId: response.data.virtualAccountData.trxId,
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
