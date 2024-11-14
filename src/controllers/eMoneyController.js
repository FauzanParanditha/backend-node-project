import uuid4 from "uuid4";
import User from "../models/userModel.js";
import { calculateTotal, validateOrderProducts } from "../utils/helper.js";
import { orderSchema, refundSchema } from "../validators/orderValidator.js";
import {
  createSignature,
  generateHeaders,
  generateMerchantTradeNo,
  generateRequestId,
  generateTimestamp,
  merchantId,
  paylabsApiUrl,
} from "../service/paylabs.js";
import {
  validateEMoneyRefund,
  validateEMoneyRequest,
  validateEmoneyStatus,
} from "../validators/paymentValidator.js";
import axios from "axios";
import Order from "../models/orderModel.js";
import logger from "../application/logger.js";

export const createEMoney = async (req, res) => {
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
        message: "user does not exist!",
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
    const requestId = generateRequestId();
    const merchantTradeNo = generateMerchantTradeNo();

    // Prepare Paylabs request payload
    const requestBody = {
      requestId,
      merchantId,
      ...(requestBodyForm.storeId && { storeId: requestBodyForm.storeId }),
      paymentType: requestBodyForm.paymentType,
      amount: requestBodyForm.totalAmount,
      merchantTradeNo,
      notifyUrl: process.env.NOTIFY_URL,
      paymentParams: {
        redirectUrl: process.env.REDIRECT_URL,
        ...(requestBodyForm.paymentType === "OVOBALANCE" && {
          phoneNumber: requestBodyForm.phoneNumber,
        }),
      },
      feeType: "OUR",
      productName: requestBodyForm.products.map((p) => p.title).join(", "),
      // productInfo: requestBodyForm.products.map((product) => ({
      //   id: product.productId.toString(),
      //   name: product.title,
      //   price: product.price,
      //   type: product.category,
      //   quantity: product.quantity,
      // })),
    };

    // Validate requestBody
    const { error } = validateEMoneyRequest(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate headers for Paylabs request
    const { headers } = generateHeaders(
      "POST",
      "/payment/v2.1/ewallet/create",
      requestBody,
      requestId
    );

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(
      `${paylabsApiUrl}/payment/v2.1/ewallet/create`,
      requestBody,
      { headers }
    );
    // console.log("Response:", response.data);

    // Check for successful response
    if (!response.data || response.data.errCode != 0) {
      return res.status(400).json({
        success: false,
        message: response.data
          ? `error: ${response.data.errCodeDes}`
          : "failed to create payment",
      });
    }

    // Save order details in the database
    const savedOrder = await Order.create({
      ...requestBodyForm,
      totalAmount: response.data.amount,
      paymentActions: response.data.paymentActions,
      paymentId: response.data.merchantTradeNo,
      paymentExpired: response.data.expiredTime,
      storeId: response.data.storeId,
      eMoney: response.data,
    });

    // Respond with created order details
    res.status(200).json({
      success: true,
      paymentActions: response.data.paymentActions,
      paymentExpired: response.data.expiredTime,
      paymentId: response.data.merchantTradeNo,
      totalAmount: response.data.amount,
      storeId: response.data.storeId,
      orderId: savedOrder._id,
    });
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error creating e-money: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "An error occurred",
      error: error.message,
    });
  }
};

export const eMoneyOrderStatus = async (req, res) => {
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
    if (!existOrder.eMoney) {
      return res.status(400).json({
        success: false,
        message: "e-money data not found in the order",
      });
    }

    // Prepare request payload for Paylabs
    const requestId = generateRequestId();

    const requestBody = {
      requestId,
      merchantId,
      ...(req.body.storeId && { storeId: req.body.storeId }),
      merchantTradeNo: existOrder.paymentId,
      paymentType: existOrder.paymentType,
    };

    // Validate requestBody
    const { error } = validateEmoneyStatus(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate headers for Paylabs request
    const { headers } = generateHeaders(
      "POST",
      "/payment/v2.1/ewallet/query",
      requestBody,
      requestId
    );

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(
      `${paylabsApiUrl}/payment/v2.1/ewallet/query`,
      requestBody,
      { headers }
    );
    // console.log(response.data);

    // Check for successful response
    if (!response.data || response.data.errCode != 0) {
      return res.status(400).json({
        success: false,
        message: response.data
          ? `error: ${response.data.errCodeDes}`
          : "failed to create payment",
      });
    }

    // Generate headers for Paylabs request
    const { responseHeaders } = generateHeaders(
      "POST",
      "/api/order/status/ewallet/:id",
      response.data,
      generateRequestId()
    );

    // Respond
    res.set(responseHeaders).status(200).json(response.data);
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error fetching e-money status: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "An error occurred",
      error: error.message,
    });
  }
};

export const createEMoneyRefund = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate request payload
    const validatedRequest = await refundSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    // Check if the order exists
    const existOrder = await Order.findById(id);
    if (!existOrder) {
      return res.status(404).json({
        success: false,
        message: "order not found",
      });
    }
    if (!existOrder.paymentPaylabs) {
      return res.status(400).json({
        success: false,
        message: "order not pay",
      });
    }

    // Check if refund is supported for the payment type
    if (existOrder.paymentType === "OVOBALANCE") {
      return res.status(400).json({
        success: false,
        error: "Refunds are not supported for OVOBALANCE payment type.",
      });
    }

    // Prepare request payload for Paylabs
    const requestId = generateRequestId();
    const refundNo = generateMerchantTradeNo();

    const requestBody = {
      requestId,
      merchantId,
      ...(existOrder.storeId && { storeId: existOrder.storeId }),
      merchantTradeNo: existOrder.paymentId,
      paymentType: existOrder.paymentType,
      amount: existOrder.totalAmount,
      refundAmount: existOrder.totalAmount,
      platformRefundNo: refundNo,
      merchantRefundNo: refundNo,
      notifyUrl: `${process.env.NOTIFY_URL}/refund`,
      reason: validatedRequest.reason,
      transFeeRate: existOrder.paymentPaylabs.transFeeRate,
      transFeeAmount: existOrder.paymentPaylabs.transFeeAmount,
      totalTransFee: existOrder.paymentPaylabs.totalTransFee,
    };

    // console.log(requestBody);

    // Validate requestBody
    const { error } = validateEMoneyRefund(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate headers for Paylabs request
    const { headers } = generateHeaders(
      "POST",
      "/payment/v2.1/ewallet/refund",
      requestBody,
      requestId
    );

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(
      `${paylabsApiUrl}/payment/v2.1/ewallet/refund`,
      requestBody,
      { headers }
    );
    // console.log(response.data);

    // Check for successful response
    if (!response.data || response.data.errCode != 0) {
      return res.status(400).json({
        success: false,
        message: response.data
          ? `error: ${response.data.errCodeDes}`
          : "failed to create payment",
      });
    }

    // Generate headers for Paylabs request
    const { responseHeaders } = generateHeaders(
      "POST",
      "/api/order/refund/ewallet/:id",
      response.data,
      generateRequestId()
    );

    // Respond
    res.set(responseHeaders).status(200).json(response.data);
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error refund e-money: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "An error occurred",
      error: error.message,
    });
  }
};
