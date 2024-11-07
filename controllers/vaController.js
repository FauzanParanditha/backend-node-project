import uuid4 from "uuid4";
import User from "../models/userModel.js";
import { calculateTotal, validateOrderProducts } from "../utils/helper.js";
import { orderSchema, vaStaticSchema } from "../validators/orderValidator.js";
import {
  createSignature,
  generateMerchantTradeNo,
  generateRequestId,
  generateTimestamp,
  merchantId,
  paylabsApiUrl,
} from "../utils/paylabs.js";
import {
  validateGenerateVA,
  validateStaticVA,
  validateVaStatus,
} from "../validators/paymentValidator.js";
import axios from "axios";
import Order from "../models/orderModel.js";
import VirtualAccount from "../models/vaModel.js";

export const createVA = async (req, res) => {
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
    const products = await validateOrderProducts(validatedProduct.products);
    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: "no valid products found to create the order",
      });
    }

    // Construct order data
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

    // Generate IDs and other necessary fields
    const timestamp = generateTimestamp();
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
      payer: existUser.fullName,
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
    const { error } = validateGenerateVA(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate signature and headers
    const signature = createSignature(
      "POST",
      "/payment/v2.1/va/create",
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
      `${paylabsApiUrl}/payment/v2.1/va/create`,
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
      virtualAccountNo: response.data.vaCode,
      paymentId: response.data.merchantTradeNo,
      storeId: response.data.storeId,
      va: response.data,
    });

    // Respond with created order details
    res.status(200).json({
      success: true,
      virtualAccountNo: response.data.vaCode,
      expiredTime: response.data.expiredTime,
      paymentId: response.data.merchantTradeNo,
      totalAmount: response.data.amount,
      storeId: response.data.storeId,
      orderId: savedOrder._id,
    });
  } catch (error) {
    // Handle unexpected errors
    return res.status(500).json({
      success: false,
      message: "an error occurred",
      error: error.message,
    });
  }
};

export const vaOrderStatus = async (req, res) => {
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
    if (!existOrder.va) {
      return res.status(400).json({
        success: false,
        message: "va data not found in the order",
      });
    }

    // Prepare request payload for Paylabs
    const timestamp = generateTimestamp();
    const requestId = generateRequestId();

    const requestBody = {
      requestId,
      merchantId,
      ...(req.body.storeId && { storeId: req.body.storeId }),
      merchantTradeNo: existOrder.paymentId,
      paymentType: existOrder.paymentType,
    };

    // Validate requestBody
    const { error } = validateVaStatus(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate signature and headers
    const signature = createSignature(
      "POST",
      "/payment/v2.1/va/query",
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
      `${paylabsApiUrl}/payment/v2.1/va/query`,
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

    // Prepare response payload and headers
    const timestampResponse = generateTimestamp();

    const signatureResponse = createSignature(
      "POST",
      "/api/order/status/va/:id",
      response.data,
      timestampResponse
    );

    const responseHeaders = {
      "Content-Type": "application/json;charset=utf-8",
      "X-TIMESTAMP": timestampResponse,
      "X-SIGNATURE": signatureResponse,
      "X-PARTNER-ID": merchantId,
      "X-REQUEST-ID": generateRequestId(),
    };

    // Respond
    res.set(responseHeaders).status(200).json(response.data);
  } catch (error) {
    // Handle unexpected errors
    return res.status(500).json({
      success: false,
      message: "an error occurred",
      error: error.message,
    });
  }
};

export const createStaticVa = async (req, res) => {
  try {
    // Validate request payload
    const validatedProduct = await vaStaticSchema.validateAsync(req.body, {
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

    // Construct order data
    const requestBodyForm = {
      orderId: uuid4(),
      userId: validatedProduct.userId,
      totalAmount: 0,
      phoneNumber: validatedProduct.phoneNumber,
      paymentStatus: "pending",
      paymentMethod: validatedProduct.paymentMethod,
      paymentType: validatedProduct.paymentType,
      ...(validatedProduct.storeId && { storeId: validatedProduct.storeId }),
    };

    // Generate IDs and other necessary fields
    const timestamp = generateTimestamp();
    const requestId = generateRequestId();

    // Prepare Paylabs request payload
    const requestBody = {
      requestId,
      merchantId,
      ...(requestBodyForm.storeId && { storeId: requestBodyForm.storeId }),
      paymentType: requestBodyForm.paymentType,
      payer: existUser.fullName,
      notifyUrl: "http://103.122.34.186:5000/api/order/webhook/paylabs/va",
    };

    // Validate requestBody
    const { error } = validateStaticVA(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate signature and headers
    const signature = createSignature(
      "POST",
      "/payment/v2.1/staticva/create",
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
      `${paylabsApiUrl}/payment/v2.1/staticva/create`,
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

    // Save va details in the database
    await VirtualAccount.create({
      userId: existUser._id,
      phoneNumber: validatedProduct.phoneNumber,
      vaCode: response.data.vaCode,
      vaStatic: response.data,
    });

    // Save order details in the database
    const savedOrder = await Order.create({
      ...requestBodyForm,
      virtualAccountNo: response.data.vaCode,
      paymentId: response.data.merchantTradeNo,
      storeId: response.data.storeId,
      va: response.data,
    });

    // Respond with created order details
    res.status(200).json({
      success: true,
      virtualAccountNo: response.data.vaCode,
      createTime: response.data.createTime,
      storeId: response.data.storeId,
      vaId: savedOrder._id,
    });
  } catch (error) {
    // Handle unexpected errors
    return res.status(500).json({
      success: false,
      message: "an error occurred",
      error: error.message,
    });
  }
};
