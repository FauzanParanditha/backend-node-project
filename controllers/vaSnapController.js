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
    const validatedProduct = await orderSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const existUser = await User.findById(validatedProduct.userId);
    if (!existUser) {
      return res.status(404).json({
        success: false,
        message: "user does not exist!",
      });
    }

    const products = await validateOrderProducts(validatedProduct.products);
    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: "no valid products found to create the order",
      });
    }

    const requestBodyForm = {
      orderId: uuid4(),
      userId: validatedProduct.userId,
      products,
      totalAmount: calculateTotal(products),
      phoneNumber: validatedProduct.phoneNumber,
      paymentStatus: "pending",
      paymentMethod: validatedProduct.paymentMethod,
      paymentType: validatedProduct.paymentType,
      ...(validatedProduct.storeId && { storeId: validatedProduct.storeId }),
    };

    const timestamp = generateTimestamp();
    const requestId = generateUUID12();
    const partnerServiceId = deriveUUID8(requestId);
    const merchantTradeNo = generateMerchantTradeNo();
    const customerNo = generateCustomerNumber();

    const requestBody = {
      partnerServiceId,
      customerNo,
      virtualAccountNo: partnerServiceId + customerNo,
      virtualAccountName: existUser.fullName,
      virtualAccountEmail: existUser.email,
      virtualAccountPhone: requestBodyForm.phoneNumber,
      trxId: merchantTradeNo,
      totalAmount: {
        value: String(requestBodyForm.totalAmount),
        currency: "IDR",
      },
      expiredDate: generateTimestamp(30 * 60 * 100),
      additionalInfo: {
        paymentType: requestBodyForm.paymentType,
      },
    };

    // Validate request body
    const { error } = validateCreateVASNAP(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate request signature
    const signature = createSignature(
      "POST",
      "/transfer-va/create-va",
      requestBody,
      timestamp
    );

    // Configure headers
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

    // Make API request to Paylabs
    const response = await axios.post(
      `${paylabsApiUrl}/api/v1.0/transfer-va/create-va`,
      requestBody,
      { headers }
    );

    // console.log("Response:", response.data);
    if (!response.data) {
      return res.status(400).json({
        success: false,
        message: "failed to create payment",
      });
    }

    if (
      response.data.responseCode.charAt(0) !== "2" &&
      requestBodyForm.paymentMethod === "paylabs"
    ) {
      return res.status(400).json({
        success: false,
        message: "error, " + response.data.errCodeDes,
      });
    }

    const savedOrder = await Order.create({
      ...requestBodyForm,
      totalAmount: response.data.virtualAccountData.totalAmount.value,
      partnerServiceId: response.data.virtualAccountData.partnerServiceId,
      customerNo: response.data.virtualAccountData.customerNo,
      virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
      vaSnap: response.data,
    });
    res.status(200).json({
      success: true,
      partnerServiceId: response.data.virtualAccountData.partnerServiceId,
      customerNo: response.data.virtualAccountData.customerNo,
      virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
      totalAmount: response.data.virtualAccountData.totalAmount.value,
      expiredDate: response.data.virtualAccountData.expiredDate,
      orderId: savedOrder._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "an error occurred",
      error: error.message,
    });
  }
};

export const vaSNAPOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
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
    if (!existOrder.vaSnap) {
      return res.status(400).json({
        success: false,
        message: "vaSnap data not found in the order",
      });
    }

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

    // Validate request body
    const { error } = validateVaSNAPStatus(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate request signature
    const signature = createSignature(
      "POST",
      "/transfer-va/status",
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
      `${paylabsApiUrl}/api/v1.0/transfer-va/status`,
      requestBody,
      { headers }
    );
    // console.log(response.data);

    if (!response.data) {
      return res.status(400).json({
        success: false,
        message: "failed to check status",
      });
    }

    if (response.data.responseCode.charAt(0) !== "2") {
      return res.status(400).json({
        success: false,
        message: "error, " + response.data.errCodeDes,
      });
    }

    // Prepare response payload and headers
    const timestampResponse = generateTimestamp();

    const responseHeaders = {
      "Content-Type": "application/json;charset=utf-8",
      "X-TIMESTAMP": timestampResponse,
    };

    res.set(responseHeaders).status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "an error occurred",
      error: error.message,
    });
  }
};

export const VaSnapCallback = async (req, res) => {
  try {
    // Extract and verify signature
    const { "x-signature": signature, "x-timestamp": timestamp } = req.headers;
    const { body: payload, method: httpMethod, originalUrl: endpointUrl } = req;

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
      customerNo: notificationData.customerNo,
    });
    if (!existOrder) {
      return res.status(404).json({
        success: false,
        message: "order does not exist!",
      });
    }
    if (existOrder.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "payment already processed",
      });
    }

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

    const responseHeaders = {
      "Content-Type": "application/json;charset=utf-8",
      "X-TIMESTAMP": timestampResponse,
    };

    res.set(responseHeaders).status(200).json(responsePayload);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "an error occurred",
      error: error.message,
    });
  }
};
