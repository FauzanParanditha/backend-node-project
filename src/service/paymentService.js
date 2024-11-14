import axios from "axios";
import { validateCreateLinkRequest } from "../validators/paymentValidator.js";
import {
  createSignature,
  generateHeaders,
  generateMerchantTradeNo,
  generateRequestId,
  generateTimestamp,
  merchantId,
  paylabsApiUrl,
} from "./paylabs.js";
import Order from "../models/orderModel.js";
import { ResponseError } from "../error/responseError.js";
import VirtualAccount from "../models/vaModel.js";
import uuid4 from "uuid4";

export const createPaymentLink = async (order) => {
  // Configuration and unique identifiers
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
    redirectUrl: process.env.REDIRECT_URL,
    ...(order.paymentType && { paymentType: order.paymentType }),
    ...(order.storeId && { storeId: order.storeId }),
    notifyUrl: process.env.NOTIFY_URL,
    feeType: "OUR",
  };

  // Validate request body
  const { error } = validateCreateLinkRequest(requestBody);
  if (error)
    throw new ResponseError(
      400,
      `Payment validation failed: ${error.details[0].message}`
    );

  // Generate headers for Paylabs request
  const { headers } = generateHeaders(
    "POST",
    "/payment/v2.1/h5/createLink",
    requestBody,
    requestId
  );
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
};

export const callbackPaylabs = async ({ payload }) => {
  // Retrieve notification data and order
  const notificationData = payload;
  const order = await Order.findOne({
    paymentId: notificationData.merchantTradeNo,
  });

  if (!order)
    throw new ResponseError(
      404,
      `Order not found for orderID: ${notificationData.merchantTradeNo}`
    );

  if (order.paymentStatus === "paid")
    throw new ResponseError(200, "Payment already processed!");

  const currentDateTime = new Date();

  const convertToDate = (paymentExpired) => {
    if (
      typeof paymentExpired === "string" &&
      paymentExpired.length === 19 &&
      paymentExpired.includes("T")
    ) {
      // ISO 8601 format: 2024-11-08T11:20:45+07:00
      return new Date(paymentExpired);
    } else if (
      typeof paymentExpired === "string" &&
      paymentExpired.length === 14
    ) {
      // Numerical string format: 20241113094019
      const formattedDate = `${paymentExpired.slice(
        0,
        4
      )}-${paymentExpired.slice(4, 6)}-${paymentExpired.slice(
        6,
        8
      )}T${paymentExpired.slice(8, 10)}:${paymentExpired.slice(
        10,
        12
      )}:${paymentExpired.slice(12)}+07:00`;
      return new Date(formattedDate);
    }
    return null;
  };

  const expiredDateTime = convertToDate(order.paymentExpired);

  // Process based on notification status
  switch (notificationData.status) {
    case "02": // Payment successful
      order.paymentStatus = "paid";
      order.totalAmount = notificationData.amount;
      order.paymentType = notificationData.paymentType;
      order.paymentLink = undefined;
      order.qris = undefined;
      order.va = undefined;
      order.vaSnap = undefined;
      order.cc = undefined;
      order.eMoney = undefined;
      order.paymentPaylabs = { ...notificationData };
      await order.save();
      break;

    case "09": // Payment failed
      order.paymentStatus = "failed";
      await order.save();
      break;

    default:
      logger.error(`Unhandled notification status: ${notificationData.status}`);
      throw new ResponseError(400, "Unhandled notification status");
  }

  // Prepare response payload and headers
  const timestampResponse = generateTimestamp();
  const responsePayload = (errorCode, errCodeDes) => {
    return {
      merchantId: process.env.PAYLABS_MERCHANT_ID,
      requestId: generateRequestId(),
      errCode: errorCode ? errorCode : notificationData.errCode,
      ...(errCodeDes && { errCodeDes: errCodeDes }),
    };
  };

  const payloadResponse = responsePayload(0, "");

  const signatureResponse = createSignature(
    "POST",
    "/api/order/webhook/paylabs",
    payloadResponse,
    timestampResponse
  );

  const responseHeaders = {
    "Content-Type": "application/json;charset=utf-8",
    "X-TIMESTAMP": timestampResponse,
    "X-SIGNATURE": signatureResponse,
    "X-PARTNER-ID": process.env.PAYLABS_MERCHANT_ID,
    "X-REQUEST-ID": generateRequestId(),
  };

  const payloadResponseError = responsePayload("orderExpired", "order expired");
  if (currentDateTime > expiredDateTime && expiredDateTime != null) {
    order.paymentStatus = "expired";
    await order.save();
    return { currentDateTime, expiredDateTime, payloadResponseError };
  }

  return { responseHeaders, payloadResponse };
};

export const callbackPaylabsVaStatic = async ({ payload }) => {
  // Retrieve notification data and order
  const notificationData = payload;
  const va = await VirtualAccount.findOne({
    vaCode: notificationData.paymentMethodInfo.vaCode,
  });

  if (!va)
    throw new ResponseError(
      404,
      `virtual account not found for vaCode: ${notificationData.paymentMethodInfo.vaCode}`
    );

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
      logger.error(`Unhandled notification status: ${notificationData.status}`);
      throw new ResponseError(400, "Unhandled notification status");
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

  return { responseHeaders, responsePayload };
};
