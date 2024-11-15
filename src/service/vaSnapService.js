import uuid4 from "uuid4";
import User from "../models/userModel.js";
import { validateOrderProducts } from "../utils/helper.js";
import {
  convertToDate,
  createSignature,
  generateCustomerNumber,
  generateMerchantTradeNo,
  generateRequestId,
  generateTimestamp,
  generateUUID12,
  merchantId,
  paylabsApiUrl,
} from "./paylabs.js";
import {
  validateCreateVASNAP,
  validatePaymentVASNAP,
  validateVaSNAPStatus,
} from "../validators/paymentValidator.js";
import axios from "axios";
import Order from "../models/orderModel.js";
import { ResponseError } from "../error/responseError.js";

export const createVASNAP = async ({ req, validatedProduct }) => {
  // Verify user existence
  const existUser = await User.findById(validatedProduct.userId);
  if (!existUser) throw new ResponseError(404, "User does not exist!");

  // Validate products in the order
  const { validProducts, totalAmount } = await validateOrderProducts(
    validatedProduct.products,
    validatedProduct.paymentType
  );
  if (!validProducts.length)
    throw new ResponseError(404, "No valid products found to create the order");

  // Construct order data
  const requestBodyForm = {
    orderId: uuid4(),
    userId: validatedProduct.userId,
    products: validProducts,
    totalAmount,
    phoneNumber: validatedProduct.phoneNumber,
    paymentStatus: "pending",
    paymentMethod: validatedProduct.paymentMethod,
    paymentType: validatedProduct.paymentType,
    ...(validatedProduct.storeId && { storeId: validatedProduct.storeId }),
  };

  // Generate IDs and other necessary fields
  const timestamp = generateTimestamp();
  const requestId = generateUUID12();
  const merchantTradeNo = generateMerchantTradeNo();
  const customerNo = generateCustomerNumber();

  // Prepare Paylabs request payload
  const requestBody = {
    partnerServiceId: `  ${merchantId}`,
    customerNo,
    virtualAccountNo: `${merchantId}${customerNo}`,
    virtualAccountName: existUser.fullName,
    virtualAccountEmail: existUser.email,
    virtualAccountPhone: requestBodyForm.phoneNumber,
    trxId: merchantTradeNo,
    totalAmount: {
      value: String(requestBodyForm.totalAmount),
      currency: "IDR",
    },
    expiredDate: generateTimestamp(300 * 60 * 100),
    additionalInfo: {
      paymentType: requestBodyForm.paymentType,
    },
  };

  // Validate requestBody
  const { error } = validateCreateVASNAP(requestBody);
  if (error)
    throw new ResponseError(
      400,
      error.details.map((err) => err.message)
    );

  // Generate signature and headers
  const signature = createSignature(
    "POST",
    "/transfer-va/create-va",
    requestBody,
    timestamp
  );
  const headers = {
    "Content-Type": "application/json;charset=utf-8",
    "X-TIMESTAMP": timestamp,
    "X-PARTNER-ID": merchantId,
    "X-EXTERNAL-ID": requestId,
    "X-SIGNATURE": signature,
    "X-IP-ADDRESS": req.ip.includes("::ffff:")
      ? req.ip.split("::ffff:")[1]
      : req.ip,
  };
  // console.log(requestBody);
  // console.log(headers);

  // Send request to Paylabs
  const response = await axios.post(
    `${paylabsApiUrl}/api/v1.0/transfer-va/create-va`,
    requestBody,
    { headers }
  );
  // console.log(response.data);

  // Check for successful response
  if (!response.data || response.data.responseCode.charAt(0) !== "2")
    throw new ResponseError(
      400,
      response.data
        ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
        : "failed to create payment"
    );

  // Save order details in the database
  const result = await Order.create({
    ...requestBodyForm,
    totalAmount: response.data.virtualAccountData.totalAmount.value,
    partnerServiceId: response.data.virtualAccountData.partnerServiceId,
    paymentId: response.data.virtualAccountData.trxId,
    paymentExpired: response.data.virtualAccountData.expiredDate,
    customerNo: response.data.virtualAccountData.customerNo,
    virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
    vaSnap: response.data,
  });

  return { response, result };
};

export const vaSNAPOrderStatus = async ({ id }) => {
  // Check if the order exists
  const existOrder = await Order.findById(id);
  if (!existOrder) throw new ResponseError(404, "Order does not exist!");

  if (existOrder.paymentStatus === "paid")
    throw new ResponseError(200, "Payment already processed!");

  if (existOrder.paymentStatus === "expired")
    throw new ResponseError(200, "Payment expired!");

  if (!existOrder.vaSnap)
    throw new ResponseError(400, "VASNAP data not found in the order");

  // Prepare request payload for Paylabs
  const timestamp = generateTimestamp();
  const requestId = generateRequestId();

  const requestBody = {
    partnerServiceId: existOrder.partnerServiceId,
    customerNo: existOrder.customerNo,
    virtualAccountNo: existOrder.virtualAccountNo,
    inquiryRequestId: requestId,
    paymentRequestId: requestId,
    additionalInfo: existOrder.vaSnap.virtualAccountData.additionalInfo,
  };

  // Validate requestBody
  const { error } = validateVaSNAPStatus(requestBody);
  if (error)
    throw new ResponseError(
      400,
      error.details.map((err) => err.message)
    );

  // Generate signature and headers
  const signature = createSignature(
    "POST",
    "/transfer-va/status",
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

  // console.log(requestBody);
  // console.log(headers);

  // Send request to Paylabs
  const response = await axios.post(
    `${paylabsApiUrl}/api/v1.0/transfer-va/status`,
    requestBody,
    { headers }
  );
  // console.log(response.data);

  // Check for successful response
  if (!response.data || response.data.responseCode.charAt(0) !== "2")
    throw new ResponseError(
      400,
      response.data
        ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
        : "failed to create payment"
    );

  // Prepare response payload and headers
  const timestampResponse = generateTimestamp();

  const responseHeaders = {
    "Content-Type": "application/json;charset=utf-8",
    "X-TIMESTAMP": timestampResponse,
  };
  return { response, responseHeaders };
};

export const VaSnapCallback = async ({ payload }) => {
  const { error } = validatePaymentVASNAP(payload);
  if (error)
    throw new ResponseError(
      400,
      error.details.map((err) => err.message)
    );

  // Retrieve notification data and order
  const notificationData = payload;
  const existOrder = await Order.findOne({
    paymentId: notificationData.trxId,
  });
  if (!existOrder)
    throw new ResponseError(
      404,
      `Order not found for orderID: ${notificationData.trxId}`
    );
  if (existOrder.paymentStatus === "paid")
    throw new ResponseError(200, "Payment already processed!");

  const currentDateTime = new Date();
  const expiredDateTime = convertToDate(
    existOrder.vaSnap.virtualAccountData.expiredDate
  );

  // Update order details in the database
  existOrder.paymentStatus = "paid";
  existOrder.totalAmount = notificationData.paidAmount.value;
  existOrder.paymentPaylabsVaSnap = { ...notificationData };
  existOrder.vaSnap = undefined;
  await existOrder.save();

  // Prepare response payload and headers
  const timestampResponse = generateTimestamp();
  const generateResponsePayload = (existOrder, statusCode, statusMessage) => {
    return {
      responseCode: statusCode || "2002500",
      responseMessage: statusMessage || "Success",
      virtualAccountData: {
        paymentFlagReason: {
          english: statusMessage || "Success",
          indonesia: statusMessage === "Success" ? "Sukses" : "Gagal",
        },
        partnerServiceId: existOrder?.paymentPaylabsVaSnap?.partnerServiceId,
        customerNo: existOrder?.paymentPaylabsVaSnap?.customerNo,
        virtualAccountNo: existOrder?.paymentPaylabsVaSnap?.virtualAccountNo,
        virtualAccountName:
          existOrder?.paymentPaylabsVaSnap?.virtualAccountName,
        virtualAccountEmail:
          existOrder?.paymentPaylabsVaSnap?.virtualAccountEmail,
        virtualAccountPhone:
          existOrder?.paymentPaylabsVaSnap?.virtualAccountPhone,
        trxId: existOrder?.paymentPaylabsVaSnap?.trxId,
        paymentRequestId: generateRequestId(),
        paidAmount: existOrder?.paymentPaylabsVaSnap?.paidAmount,
        paidBills: existOrder?.paymentPaylabsVaSnap?.paidBills,
        totalAmount: existOrder?.paymentPaylabsVaSnap?.totalAmount,
        trxDateTime: existOrder?.paymentPaylabsVaSnap?.trxDateTime,
        referenceNo: existOrder?.paymentPaylabsVaSnap?.referenceNo,
        journalNum: existOrder?.paymentPaylabsVaSnap?.journalNum,
        paymentType: existOrder?.paymentPaylabsVaSnap?.paymentType,
        flagAdvise: existOrder?.paymentPaylabsVaSnap?.flagAdvise,
        paymentFlagStatus: statusCode === "2002500" ? "00" : "01",
        billDetails: {
          billerReferenceId: generateRequestId(),
          billCode: existOrder?.paymentPaylabsVaSnap?.billDetails?.billCode,
          billNo: existOrder?.paymentPaylabsVaSnap?.billDetails?.billNo,
          billName: existOrder?.paymentPaylabsVaSnap?.billDetails?.billName,
          billShortName:
            existOrder?.paymentPaylabsVaSnap?.billDetails?.billShortName,
          billDescription:
            existOrder?.paymentPaylabsVaSnap?.billDetails?.billDescription,
          billSubCompany:
            existOrder?.paymentPaylabsVaSnap?.billDetails?.billSubCompany,
          billAmount: existOrder?.paymentPaylabsVaSnap?.billDetails?.billAmount,
          additionalInfo:
            existOrder?.paymentPaylabsVaSnap?.billDetails?.additionalInfo,
          status: statusCode === "2002500" ? "00" : "01",
          reason: {
            english: statusMessage || "Success",
            indonesia: statusMessage === "Success" ? "Sukses" : "Gagal",
          },
        },
        freeTexts: existOrder?.paymentPaylabsVaSnap?.freeTexts,
        additionalInfo: existOrder?.paymentPaylabsVaSnap?.additionalInfo,
      },
    };
  };

  // Generate response headers
  const responseHeaders = {
    "Content-Type": "application/json;charset=utf-8",
    "X-TIMESTAMP": timestampResponse,
  };

  if (currentDateTime > expiredDateTime) {
    existOrder.paymentStatus = "expired";
    await existOrder.save();
    const payloadResponseError = generateResponsePayload(
      existOrder,
      "4030000",
      "Expired"
    );
    return { currentDateTime, expiredDateTime, payloadResponseError };
  }
  const payloadResponse = generateResponsePayload(existOrder);
  return { responseHeaders, payloadResponse };
};

export const updateVASNAP = async ({ id, validatedUpdateData, req }) => {
  // Check if the order exists
  const existingOrder = await Order.findById(id);
  if (!existingOrder) throw new ResponseError(404, "Order does not exist!");

  if (existingOrder.paymentStatus === "paid")
    throw new ResponseError(200, "Payment already processed!");

  //check expired
  const currentDateTime = new Date();
  const expiredDateTime = new Date(existingOrder.paymentExpired);

  if (currentDateTime > expiredDateTime) {
    existingOrder.paymentStatus = "expired";
    await existingOrder.save();
    return { currentDateTime, expiredDateTime };
  }

  if (!existingOrder.vaSnap)
    throw new ResponseError(200, "Payment already processed!");

  // Check if the user exists
  const existUser = await User.findById(existingOrder.userId);
  if (!existUser) throw new ResponseError(404, "User does not exist!");

  // Validate products in the order
  const { validProducts, totalAmount } = await validateOrderProducts(
    validatedUpdateData.products,
    validatedUpdateData.paymentType || undefined
  );
  if (!validProducts.length)
    throw new ResponseError(404, "No valid products found to create the order");

  // Update order details
  const updatedOrderData = {
    ...existingOrder._doc,
    ...validatedUpdateData,
    totalAmount,
    paymentStatus:
      validatedUpdateData.paymentStatus || existingOrder.paymentStatus,
  };

  // Prepare request payload for Paylabs
  const timestamp = generateTimestamp();
  const requestId = uuid4();
  const requestBody = {
    partnerServiceId: existingOrder.vaSnap.virtualAccountData.partnerServiceId,
    customerNo: existingOrder.vaSnap.virtualAccountData.customerNo,
    virtualAccountNo: existingOrder.vaSnap.virtualAccountData.virtualAccountNo,
    virtualAccountName:
      existingOrder.vaSnap.virtualAccountData.virtualAccountName,
    virtualAccountEmail:
      existingOrder.vaSnap.virtualAccountData.virtualAccountEmail,
    virtualAccountPhone: updatedOrderData.phoneNumber,
    trxId: generateMerchantTradeNo(),
    totalAmount: {
      value: String(updatedOrderData.totalAmount),
      currency: "IDR",
    },
    expiredDate: generateTimestamp(300 * 60 * 100),
    additionalInfo: {
      paymentType: updatedOrderData.paymentType,
    },
  };

  // Validate requestBody
  const { error } = validateCreateVASNAP(requestBody);
  if (error)
    throw new ResponseError(
      400,
      error.details.map((err) => err.message)
    );

  // Generate signature and headers
  const signature = createSignature(
    "POST",
    "/transfer-va/update-va",
    requestBody,
    timestamp
  );
  const headers = {
    "Content-Type": "application/json;charset=utf-8",
    "X-TIMESTAMP": timestamp,
    "X-PARTNER-ID": merchantId,
    "X-EXTERNAL-ID": requestId,
    "X-SIGNATURE": signature,
    "X-IP-ADDRESS": req.ip.includes("::ffff:")
      ? req.ip.split("::ffff:")[1]
      : req.ip,
  };

  // Send request to Paylabs
  const response = await axios.post(
    `${paylabsApiUrl}/api/v1.0/transfer-va/update-va`,
    requestBody,
    { headers }
  );

  // Check for successful response
  if (!response.data || response.data.responseCode.charAt(0) !== "2")
    throw new ResponseError(
      400,
      response.data
        ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
        : "failed to create payment"
    );
  // Update validatedUpdateData with validProducts
  updatedOrderData.products = validProducts;
  updatedOrderData.vaSnap = response.data;
  (updatedOrderData.partnerServiceId =
    response.data.virtualAccountData.partnerServiceId),
    (updatedOrderData.paymentId = response.data.virtualAccountData.trxId),
    (updatedOrderData.paymentExpired =
      response.data.virtualAccountData.expiredDate),
    (updatedOrderData.customerNo = response.data.virtualAccountData.customerNo),
    (updatedOrderData.virtualAccountNo =
      response.data.virtualAccountData.virtualAccountNo),
    // Update order in the database
    await Order.findByIdAndUpdate(id, updatedOrderData, { new: true });

  return { response };
};
