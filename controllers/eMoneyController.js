import uuid4 from "uuid4";
import User from "../models/userModel.js";
import { calculateTotal, validateOrderProducts } from "../utils/helper.js";
import { orderSchema } from "../validators/orderValidator.js";
import {
  createSignature,
  generateMerchantTradeNo,
  generateRequestId,
  generateTimestamp,
  merchantId,
  paylabsApiUrl,
} from "../utils/paylabs.js";
import {
  validateEMoneyRequest,
  validateEmoneyStatus,
} from "../validators/paymentValidator.js";
import axios from "axios";
import Order from "../models/orderModel.js";

export const createEMoney = async (req, res) => {
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
    const requestId = generateRequestId();
    const merchantTradeNo = generateMerchantTradeNo();

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

    // Validate request body
    const { error } = validateEMoneyRequest(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate request signature
    const signature = createSignature(
      "POST",
      "/payment/v2.1/ewallet/create",
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
      `${paylabsApiUrl}/payment/v2.1/ewallet/create`,
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
      response.data.errCode != 0 &&
      requestBodyForm.paymentMethod === "paylabs"
    ) {
      return res.status(400).json({
        success: false,
        message: "error, " + response.data.errCodeDes,
      });
    }

    const savedOrder = await Order.create({
      ...requestBodyForm,
      totalAmount: response.data.amount,
      paymentActions: response.data.paymentActions,
      paymentId: response.data.merchantTradeNo,
      storeId: response.data.storeId,
      eMoney: response.data,
    });
    res.status(200).json({
      success: true,
      paymentActions: response.data.paymentActions,
      expiredTime: response.data.expiredTime,
      paymentId: response.data.merchantTradeNo,
      totalAmount: response.data.amount,
      storeId: response.data.storeId,
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

export const eMoneyOrderStatus = async (req, res) => {
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
    if (!existOrder.eMoney) {
      return res.status(400).json({
        success: false,
        message: "e-money data not found in the order",
      });
    }

    const timestamp = generateTimestamp();
    const requestId = generateRequestId();

    const requestBody = {
      requestId,
      merchantId,
      ...(req.body.storeId && { storeId: req.body.storeId }),
      merchantTradeNo: existOrder.paymentId,
      paymentType: existOrder.paymentType,
    };

    // Validate request body
    const { error } = validateEmoneyStatus(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate request signature
    const signature = createSignature(
      "POST",
      "/payment/v2.1/ewallet/query",
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
      `${paylabsApiUrl}/payment/v2.1/ewallet/query`,
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

    if (response.data.errCode != 0) {
      return res.status(400).json({
        success: false,
        message: "error, " + response.data.errCodeDes,
      });
    }

    // Prepare response payload and headers
    const timestampResponse = generateTimestamp();

    const signatureResponse = createSignature(
      "POST",
      "/api/order/status/ewallet/:id",
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

    res.set(responseHeaders).status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "an error occurred",
      error: error.message,
    });
  }
};
