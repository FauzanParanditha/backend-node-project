import uuid4 from "uuid4";
import User from "../models/userModel.js";
import { validateOrderProducts } from "../utils/helper.js";
import {
  generateHeaders,
  generateMerchantTradeNo,
  generateRequestId,
  merchantId,
  paylabsApiUrl,
} from "./paylabs";
import {
  validateCCStatus,
  validateCreditCardRequest,
} from "../validators/paymentValidator";
import axios from "axios";

export const createCC = async ({ validatedProduct }) => {
  // Verify user existence
  const existUser = await User.findById(validatedProduct.userId);
  if (!existUser) throw new error("User is not exist!");

  // Validate products in the order
  const { validProducts, totalAmount } = await validateOrderProducts(
    validatedProduct.products,
    validatedProduct.paymentType
  );
  if (!validProducts.length)
    throw new Error("No valid products found to update the order");

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
  if (error) throw new Error(error.details.map((err) => err.message));

  // Generate headers for Paylabs request
  const { headers } = generateHeaders(
    "POST",
    "/payment/v2.1/cc/create",
    requestBody,
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
  if (!response.data || response.data.errCode != 0)
    throw new Error(
      response.data
        ? `error: ${response.data.errCodeDes}`
        : "failed to create payment"
    );

  // Save order details in the database
  const result = await Order.create({
    ...requestBodyForm,
    totalAmount: response.data.amount,
    paymentLink: response.data.paymentActions.payUrl,
    paymentId: response.data.merchantTradeNo,
    paymentExpired: response.data.expiredTime,
    storeId: response.data.storeId,
    cc: response.data,
  });
  return { response, result };
};

export const ccOrderStatus = async ({ id }) => {
  // Check if the order exists
  const existOrder = await Order.findById(id);
  if (!existOrder) throw new error("Order is not exist!");

  if (existOrder.paymentStatus === "paid")
    throw new Error("Payment already processed!");

  if (existOrder.paymentStatus === "expired")
    throw new Error("Payment expired!");

  if (!existOrder.cc) throw new Error("CC data not found in the order");

  // Prepare request payload for Paylabs
  const requestId = generateRequestId();

  const requestBody = {
    requestId,
    merchantId,
    ...(existOrder.storeId && { storeId: existOrder.storeId }),
    merchantTradeNo: existOrder.paymentId,
    paymentType: existOrder.paymentType,
  };

  // Validate requestBody
  const { error } = validateCCStatus(requestBody);
  if (error) throw new Error(error.details.map((err) => err.message));

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
  if (!response.data || response.data.errCode != 0)
    throw new Error(
      response.data
        ? `error: ${response.data.errCodeDes}`
        : "failed to create payment"
    );

  // Generate headers for Paylabs request
  const { responseHeaders } = generateHeaders(
    "POST",
    "/api/order/status/cc/:id",
    response.data,
    generateRequestId()
  );

  return { response, responseHeaders };
};
