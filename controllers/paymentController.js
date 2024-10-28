import axios from "axios";
import {
  createSignature,
  generateTimestamp,
  verifySignature,
} from "../utils/helper.js";
import { validateCreateLinkRequest } from "../validators/paymentValidator.js";
import uuid4 from "uuid4";
import Order from "../models/orderModel.js";

export const createPaymentLink = async (order) => {
  try {
    const paylabsApiUrl = process.env.PAYLABS_API_URL;
    const merchantId = process.env.PAYLABS_MERCHANT_ID;
    const timestamp = generateTimestamp();
    const requestId = `req-${uuid4()}`;
    const merchantTradeNo = `merch-${uuid4().substring(0, 32 - 6)}`;

    const requestBody = {
      merchantId: merchantId,
      merchantTradeNo: merchantTradeNo,
      requestId: requestId,
      amount: order.totalAmount,
      phoneNumber: order.phoneNumber,
      productName: order.products.map((p) => p.title).join(", "),
      redirectUrl: "http:localhost:5000",
      // lang: "en",
    };

    // Validate request body using Joi
    const { error } = validateCreateLinkRequest(requestBody);

    if (error) {
      throw new Error(`Payment validation failed: ${error.details[0].message}`);
    }

    // Generate the signature
    const signature = createSignature(
      "POST",
      "/payment/v2.1/h5/createLink",
      requestBody,
      timestamp
    );

    const headers = {
      "Content-Type": "application/json;charset=utf-8",
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
      "X-PARTNER-ID": merchantId,
      "X-REQUEST-ID": requestId,
    };

    // console.log("headers:", headers);
    // console.log("body:", requestBody);

    const response = await axios.post(
      `${paylabsApiUrl}/payment/v2.1/h5/createLink`,
      requestBody,
      { headers }
    );

    // console.log(response.data);
    // const result = {
    //   headers,
    //   requestBody,
    // };

    return response.data;
  } catch (err) {
    throw new Error(`Payment initiation failed: ${err.message}`);
  }
};

export const paylabsCallback = async (req, res) => {
  try {
    //Verify the signature
    const signature = req.headers["x-signature"];
    const payload = JSON.stringify(req.body);

    // Verify the notification signature
    if (!verifySignature(signature, payload)) {
      return res.status(401).send("Invalid signature");
    }

    const notificationData = req.body;

    const order = await Order.findOne({
      requestId: notificationData.requestId,
    });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found for orderID: ${event.external_id}`,
      });
    }

    if (order.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "payment has been already processed",
      });
    }

    switch (notificationData.status) {
      case "02":
        order.paymentStatus = "paid";
        order.paymentLink = undefined;
        order.paymentPaylabs = {
          merchantId: notificationData.merchantId,
          requestId: notificationData.requestId,
          errCode: notificationData.errCode,
          paymentType: notificationData.paymentType,
          amount: notificationData.amount,
          createTime: notificationData.createTime,
          successTime: notificationData.successTime,
          merchantTradeNo: notificationData.merchantTradeNo,
          platformTradeNo: notificationData.platformTradeNo,
          status: notificationData.status,
          vaCode: notificationData.vaCode,
          transFeeRate: notificationData.transFeeRate,
          transFeeAmount: notificationData.transFeeAmount,
          totalTransFee: notificationData.totalTransFee,
          vatFee: notificationData.vatFee,
        };
        await order.save();
        break;
      case "09":
        order.paymentStatus = "failed";
        await order.save();
        break;
      default:
        console.log(
          `Unhandled notificationData status: ${notificationData.status}`
        );
    }
    res.status(200).json({ success: true, message: "successfully" });
  } catch (error) {
    console.error("Error handling webhook:", error);
    res
      .status(500)
      .json({ success: false, message: "Webhook handling failed" });
  }
};
