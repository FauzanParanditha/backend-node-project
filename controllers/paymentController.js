import axios from "axios";
import {
  createSignature,
  generateMerchantTradeNo,
  generateRequestId,
  generateTimestamp,
  merchantId,
  paylabsApiUrl,
  verifySignature,
} from "../utils/paylabs.js";
import { validateCreateLinkRequest } from "../validators/paymentValidator.js";
import uuid4 from "uuid4";
import Order from "../models/orderModel.js";

// Create a payment link with Paylabs
export const createPaymentLink = async (order) => {
  try {
    // Configuration and unique identifiers
    const timestamp = generateTimestamp();
    const requestId = generateRequestId();
    const merchantTradeNo = generateMerchantTradeNo();

    // Prepare request payload
    const requestBody = {
      merchantId,
      merchantTradeNo,
      requestId,
      amount: order.totalAmount,
      phoneNumber: order.phoneNumber,
      productName: order.products.map((p) => p.title).join(", "),
      redirectUrl: "http://103.122.34.186:5000",
      ...(order.storeId && { storeId: order.storeId }),
      notifyUrl: "http://103.122.34.186:5000/api/order/webhook/paylabs",
      feeType: "OUR",
    };

    // Validate request body
    const { error } = validateCreateLinkRequest(requestBody);
    if (error)
      throw new Error(`Payment validation failed: ${error.details[0].message}`);

    // Generate request signature
    const signature = createSignature(
      "POST",
      "/payment/v2.1/h5/createLink",
      requestBody,
      timestamp
    );

    // Configure headers
    const headers = {
      "Content-Type": "application/json;charset=utf-8",
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
      "X-PARTNER-ID": merchantId,
      "X-REQUEST-ID": requestId,
    };

    // console.log(requestBody);
    // console.log(headers);

    // Make API request to Paylabs
    const response = await axios.post(
      `${paylabsApiUrl}/payment/v2.1/h5/createLink`,
      requestBody,
      { headers }
    );

    // console.log("Response:", response.data);
    return response.data;
  } catch (err) {
    throw new Error(`Payment initiation failed: ${err.message}`);
  }
};

// Handle Paylabs callback notifications
export const paylabsCallback = async (req, res) => {
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
    const order = await Order.findOne({
      paymentId: notificationData.merchantTradeNo,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found for orderID: ${notificationData.merchantTradeNo}`,
      });
    }

    if (order.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "payment has already been processed",
      });
    }

    // Process based on notification status
    switch (notificationData.status) {
      case "02": // Payment successful
        order.paymentStatus = "paid";
        order.amount = notificationData.amount;
        order.paymentLink = undefined;
        order.qris = undefined;
        order.va = undefined;
        order.paymentPaylabs = { ...notificationData };
        await order.save();
        break;

      case "09": // Payment failed
        order.paymentStatus = "failed";
        await order.save();
        break;

      default:
        console.log(
          `Unhandled notification status: ${notificationData.status}`
        );
    }

    // Prepare response payload and headers
    const timestampResponse = generateTimestamp();
    const responsePayload = {
      merchantId: process.env.PAYLABS_MERCHANT_ID,
      requestId: notificationData.requestId,
      errCode: notificationData.errCode,
    };

    const signatureResponse = createSignature(
      "POST",
      "/api/order/webhook/paylabs",
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
    console.error("Error handling webhook:", error);
    res
      .status(500)
      .json({ success: false, message: "webhook handling failed" });
  }
};
