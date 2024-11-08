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
} from "../utils/paylabs.js";
import {
  validateCreateVASNAP,
  validatePaymentVASNAP,
  validateVaSNAPStatus,
} from "../validators/paymentValidator.js";
import axios from "axios";
import Order from "../models/orderModel.js";

export const createVASNAP = async (req, res) => {
  try {
    // Validate request payload
    const validatedProduct = await orderSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    // Verify user existence
    const existUser = await User.findById(validatedProduct.userId);
    if (!existUser) {
      return res.status(404).json({
        success: false,
        message: "user does not exist",
      });
    }

    // Validate products in the order
    const { validProducts, totalAmount } = await validateOrderProducts(
      validatedProduct.products,
      validatedProduct.paymentType
    );
    if (!validProducts.length) {
      return res.status(404).json({
        success: false,
        message: "no valid products found to create the order",
      });
    }

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
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

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

    // Send request to Paylabs
    const response = await axios.post(
      `${paylabsApiUrl}/api/v1.0/transfer-va/create-va`,
      requestBody,
      { headers }
    );

    // Check for successful response
    if (!response.data || response.data.responseCode.charAt(0) !== "2") {
      return res.status(400).json({
        success: false,
        message: response.data
          ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
          : "failed to create payment",
      });
    }

    // Save order details in the database
    const savedOrder = await Order.create({
      ...requestBodyForm,
      totalAmount: response.data.virtualAccountData.totalAmount.value,
      partnerServiceId: response.data.virtualAccountData.partnerServiceId,
      paymentId: response.data.virtualAccountData.trxId,
      paymentExpired: response.data.virtualAccountData.expiredDate,
      customerNo: response.data.virtualAccountData.customerNo,
      virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
      vaSnap: response.data,
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
      orderId: savedOrder._id,
    });
  } catch (error) {
    // Handle unexpected errors
    return res.status(500).json({
      success: false,
      status: error.status,
      message: "an error occurred",
      error: `error: ${error.response.data.responseMessage} with code ${error.response.data.responseCode}`,
    });
  }
};

export const vaSNAPOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the order exists
    const existOrder = await Order.findById(id);
    if (!existOrder) {
      return res.status(404).json({
        success: false,
        message: "order not found",
      });
    }
    if (existOrder.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "payment already processed",
      });
    }
    if (existOrder.paymentStatus === "expired") {
      return res.status(200).json({
        success: true,
        message: "payment expired",
      });
    }
    if (!existOrder.vaSnap) {
      return res.status(400).json({
        success: false,
        message: "vaSnap data not found in the order",
      });
    }

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
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

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
    if (!response.data || response.data.responseCode.charAt(0) !== "2") {
      return res.status(400).json({
        success: false,
        message: response.data
          ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
          : "failed to create payment",
      });
    }

    // Prepare response payload and headers
    const timestampResponse = generateTimestamp();

    const responseHeaders = {
      "Content-Type": "application/json;charset=utf-8",
      "X-TIMESTAMP": timestampResponse,
    };

    // Respond
    res.set(responseHeaders).status(200).json(response.data);
  } catch (error) {
    // Handle unexpected errors
    return res.status(500).json({
      success: false,
      status: error.status,
      message: "an error occurred",
      error: `error: ${error.response.data.responseMessage} with code ${error.response.data.responseCode}`,
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

    const { error } = validatePaymentVASNAP(payload);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Retrieve notification data and order
    const notificationData = payload;
    const existOrder = await Order.findOne({
      paymentId: notificationData.trxId,
    });
    if (!existOrder) {
      return res.status(404).json({
        success: false,
        message: `Order not found for orderID: ${notificationData.trxId}`,
      });
    }
    if (existOrder.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "payment already processed",
      });
    }

    const currentDateTime = new Date();
    const expiredDateTime = new Date(
      existOrder.vaSnap.virtualAccountData.expiredDate
    );

    if (currentDateTime > expiredDateTime) {
      existOrder.paymentStatus = "expired";
      await existOrder.save();
      return res.status(400).json({
        success: false,
        message: "Order has expired",
      });
    }

    // Update order details in the database
    existOrder.paymentStatus = "paid";
    existOrder.totalAmount = notificationData.paidAmount.value;
    existOrder.paymentPaylabsVaSnap = { ...notificationData };
    existOrder.vaSnap = undefined;
    await existOrder.save();

    // Prepare response payload and headers
    const timestampResponse = generateTimestamp();
    const responsePayload = {
      responseCode: "2002500",
      responseMessage: "Success",
      virtualAccountData: {
        paymentFlagReason: {
          english: "Success",
          indonesia: "Sukses",
        },
        partnerServiceId: existOrder.paymentPaylabsVaSnap.partnerServiceId,
        customerNo: existOrder.paymentPaylabsVaSnap.customerNo,
        virtualAccountNo: existOrder.paymentPaylabsVaSnap.virtualAccountNo,
        virtualAccountName: existOrder.paymentPaylabsVaSnap.virtualAccountName,
        virtualAccountEmail:
          existOrder.paymentPaylabsVaSnap.virtualAccountEmail,
        virtualAccountPhone:
          existOrder.paymentPaylabsVaSnap.virtualAccountPhone,
        trxId: existOrder.paymentPaylabsVaSnap.trxId,
        paymentRequestId: generateRequestId(),
        paidAmount: existOrder.paymentPaylabsVaSnap.paidAmount,
        paidBills: existOrder.paymentPaylabsVaSnap.paidBills,
        totalAmount: existOrder.paymentPaylabsVaSnap.totalAmount,
        trxDateTime: existOrder.paymentPaylabsVaSnap.trxDateTime,
        referenceNo: existOrder.paymentPaylabsVaSnap.referenceNo,
        journalNum: existOrder.paymentPaylabsVaSnap.journalNum,
        paymentType: existOrder.paymentPaylabsVaSnap.paymentType,
        flagAdvise: existOrder.paymentPaylabsVaSnap.flagAdvise,
        paymentFlagStatus: "00",
        billDetails: {
          billerReferenceId: generateRequestId(),
          billCode: existOrder.paymentPaylabsVaSnap.billDetails.billCode,
          billNo: existOrder.paymentPaylabsVaSnap.billDetails.billNo,
          billName: existOrder.paymentPaylabsVaSnap.billDetails.billName,
          billShortName:
            existOrder.paymentPaylabsVaSnap.billDetails.billShortName,
          billDescription:
            existOrder.paymentPaylabsVaSnap.billDetails.billDescription,
          billSubCompany:
            existOrder.paymentPaylabsVaSnap.billDetails.billSubCompany,
          billAmount: existOrder.paymentPaylabsVaSnap.billDetails.billAmount,
          additionalInfo:
            existOrder.paymentPaylabsVaSnap.billDetails.additionalInfo,
          status: "00",
          reason: {
            english: "Success",
            indonesia: "Sukses",
          },
        },
        freeTexts: existOrder.paymentPaylabsVaSnap.freeTexts,
        additionalInfo: existOrder.paymentPaylabsVaSnap.additionalInfo,
      },
    };

    // Generate response headers
    const responseHeaders = {
      "Content-Type": "application/json;charset=utf-8",
      "X-TIMESTAMP": timestampResponse,
    };

    // Respond
    res.set(responseHeaders).status(200).json(responsePayload);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "an error occurred",
      error: error.message,
    });
  }
};

export const updateVASNAP = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate the update payload
    const validatedUpdateData = await orderSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    // Check if the order exists
    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "order not found",
      });
    }
    if (existingOrder.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "payment has already processed",
      });
    }
    if (existingOrder.paymentStatus === "expired") {
      return res.status(200).json({
        success: true,
        message: "payment expired",
      });
    }
    if (!existingOrder.vaSnap) {
      return res.status(200).json({
        success: true,
        message: "order has already processed",
      });
    }

    // Check if the user exists
    const existUser = await User.findById(existingOrder.userId);
    if (!existUser) {
      return res.status(404).json({
        success: false,
        message: "user does not exist",
      });
    }

    // Validate products in the order
    const { validProducts, totalAmount } = await validateOrderProducts(
      validatedUpdateData.products,
      validatedUpdateData.paymentType || undefined
    );
    if (!validProducts.length) {
      return res.status(404).json({
        success: false,
        message: "no valid products found to create the order",
      });
    }

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
      partnerServiceId:
        existingOrder.vaSnap.virtualAccountData.partnerServiceId,
      customerNo: existingOrder.vaSnap.virtualAccountData.customerNo,
      virtualAccountNo:
        existingOrder.vaSnap.virtualAccountData.virtualAccountNo,
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
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

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
    if (!response.data || response.data.responseCode.charAt(0) !== "2") {
      return res.status(400).json({
        success: false,
        message: response.data
          ? `error: ${response.data.responseMessage} with code ${response.data.responseCode}`
          : "failed to create payment",
      });
    }

    // Update order in the database
    await Order.findByIdAndUpdate(
      validatedUpdateData.orderId,
      updatedOrderData
    );

    // Send a response with the updated order details
    res.status(200).json({
      success: true,
      partnerServiceId: response.data.virtualAccountData.partnerServiceId,
      customerNo: response.data.virtualAccountData.customerNo,
      virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
      totalAmount: response.data.virtualAccountData.totalAmount.value,
      expiredDate: response.data.virtualAccountData.expiredDate,
      paymentId: response.data.virtualAccountData.trxId,
      orderId: savedOrder._id,
    });
  } catch (error) {
    // Handle unexpected errors
    return res.status(500).json({
      success: false,
      status: error.status,
      message: "an error occurred",
      error: `error: ${error.response.data.responseMessage} with code ${error.response.data.responseCode}`,
    });
  }
};
