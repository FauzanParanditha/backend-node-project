import uuid4 from "uuid4";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import { calculateTotal, validateOrderProducts } from "../utils/helper.js";
import {
  createSignature,
  generateHeaders,
  generateMerchantTradeNo,
  generateRequestId,
  generateTimestamp,
  merchantId,
  paylabsApiUrl,
} from "../utils/paylabs.js";
import { orderSchema } from "../validators/orderValidator.js";
import {
  validateCCStatus,
  validateCreditCardRequest,
} from "../validators/paymentValidator.js";
import axios from "axios";
import logger from "../utils/logger.js";

export const createCreditCard = async (req, res) => {
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
      notifyUrl: "http://103.122.34.186:5000/api/order/webhook/paylabs",
      paymentParams: {
        redirectUrl: "http://103.122.34.186:5000",
      },
      productName: requestBodyForm.products.map((p) => p.title).join(", "),
      // productInfo: requestBodyForm.products.map((product) => ({
      //   id: product.productId.toString(),
      //   name: product.title,
      //   price: product.price,
      //   type: product.category,
      //   quantity: product.quantity,
      // })),
      feeType: "OUR",
    };

    // Validate requestBody
    const { error } = validateCreditCardRequest(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate headers for Paylabs request
    const { headers } = generateHeaders(
      "POST",
      "/payment/v2.1/cc/create",
      response.data,
      requestId
    );

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(
      `${paylabsApiUrl}/payment/v2.1/cc/create`,
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
      paymentLink: response.data.paymentActions.payUrl,
      paymentId: response.data.merchantTradeNo,
      paymentExpired: response.data.expiredTime,
      storeId: response.data.storeId,
      cc: response.data,
    });

    // Respond with created order details
    res.status(200).json({
      success: true,
      paymentLink: response.data.paymentActions.payUrl,
      PaymentExpired: response.data.expiredTime,
      paymentId: response.data.merchantTradeNo,
      totalAmount: response.data.amount,
      storeId: response.data.storeId,
      orderId: savedOrder._id,
    });
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error creating cc: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "an error occurred",
      error: error.message,
    });
  }
};

export const ccOrderStatus = async (req, res) => {
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
    if (!existOrder.cc) {
      return res.status(400).json({
        success: false,
        message: "cc data not found in the order",
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
    const { error } = validateCCStatus(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate headers for Paylabs request
    const { headers } = generateHeaders(
      "POST",
      "/payment/v2.1/cc/query",
      requestBody,
      requestId
    );

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(
      `${paylabsApiUrl}/payment/v2.1/cc/query`,
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
      "/api/order/status/cc/:id",
      response.data,
      generateRequestId()
    );

    // Respond
    res.set(responseHeaders).status(200).json(response.data);
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Error fetching cc status: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "an error occurred",
      error: error.message,
    });
  }
};
