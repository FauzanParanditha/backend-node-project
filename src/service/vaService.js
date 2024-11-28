import uuid4 from "uuid4";
import User from "../models/userModel.js";
import { validateOrderProducts } from "../utils/helper.js";
import { ResponseError } from "../error/responseError.js";
import { generateHeaders, generateMerchantTradeNo, generateRequestId, merchantId, paylabsApiUrl } from "./paylabs.js";
import { validateGenerateVA, validateStaticVA, validateVaStatus } from "../validators/paymentValidator.js";
import axios from "axios";
import Order from "../models/orderModel.js";
import VirtualAccount from "../models/vaModel.js";

export const createVa = async ({ validatedProduct }) => {
    // Verify user existence
    const existUser = await User.findById(validatedProduct.userId);
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    // Validate products in the order
    const { validProducts, totalAmount } = await validateOrderProducts(
        validatedProduct.products,
        validatedProduct.paymentType,
    );
    if (!validProducts.length) throw new ResponseError(404, "No valid products found to create the order");

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
        payer: existUser.fullName,
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
    const { error } = validateGenerateVA(requestBody);
    if (error)
        throw new ResponseError(
            400,
            error.details.map((err) => err.message),
        );

    // Generate headers for Paylabs request
    const { headers } = generateHeaders("POST", "/payment/v2.1/va/create", requestBody, requestId);

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/va/create`, requestBody, { headers });
    // console.log("Response:", response.data);

    // Check for successful response
    if (!response.data || response.data.errCode != 0)
        throw new ResponseError(400, response.data ? `error: ${response.data.errCodeDes}` : "failed to create payment");

    // Save order details in the database
    const result = await Order.create({
        ...requestBodyForm,
        totalAmount: response.data.amount,
        virtualAccountNo: response.data.vaCode,
        paymentId: response.data.merchantTradeNo,
        paymentExpired: response.data.expiredTime,
        storeId: response.data.storeId,
        va: response.data,
    });

    return { response, result };
};

export const vaOrderStatus = async ({ id }) => {
    // Check if the order exists
    const existOrder = await Order.findById(id);
    if (!existOrder) throw new ResponseError(404, "Order does not exist!");

    if (existOrder.paymentStatus === "paid") throw new ResponseError(200, "Payment already processed!");

    if (existOrder.paymentStatus === "expired") throw new ResponseError(200, "Payment expired!");

    if (!existOrder.va) throw new ResponseError(400, "VA data not found in the order");

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
    const { error } = validateVaStatus(requestBody);
    if (error)
        throw new ResponseError(
            400,
            error.details.map((err) => err.message),
        );

    // Generate headers for Paylabs request
    const { headers } = generateHeaders("POST", "/payment/v2.1/va/query", requestBody, requestId);

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/va/query`, requestBody, { headers });
    // console.log(response.data);

    // Check for successful response
    if (!response.data || response.data.errCode != 0)
        throw new ResponseError(400, response.data ? `error: ${response.data.errCodeDes}` : "failed to create payment");

    // Generate headers for Paylabs request
    const { responseHeaders } = generateHeaders("POST", "/api/order/status/va/:id", response.data, generateRequestId());

    return { response, responseHeaders };
};

export const createVaStatic = async ({ validatedProduct }) => {
    // Verify user existence
    const existUser = await User.findById(validatedProduct.userId);
    if (!existUser) throw new ResponseError(404, "User does not exist!");

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
    const requestId = generateRequestId();

    // Prepare Paylabs request payload
    const requestBody = {
        requestId,
        merchantId,
        ...(requestBodyForm.storeId && { storeId: requestBodyForm.storeId }),
        paymentType: requestBodyForm.paymentType,
        payer: existUser.fullName,
        notifyUrl: `${process.env.NOTIFY_URL}/va`,
    };

    // Validate requestBody
    const { error } = validateStaticVA(requestBody);
    if (error)
        throw new ResponseError(
            400,
            error.details.map((err) => err.message),
        );

    // Generate headers for Paylabs request
    const { headers } = generateHeaders("POST", "/payment/v2.1/staticva/create", requestBody, requestId);

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/staticva/create`, requestBody, { headers });
    // console.log("Response:", response.data);

    // Check for successful response
    if (!response.data || response.data.errCode != 0) {
        return res.status(400).json({
            success: false,
            message: response.data ? `error: ${response.data.errCodeDes}` : "failed to create payment",
        });
    }

    // Save va details in the database
    const result = await VirtualAccount.create({
        userId: existUser._id,
        phoneNumber: validatedProduct.phoneNumber,
        vaCode: response.data.vaCode,
        vaStatic: response.data,
    });

    // Save order details in the database
    // const savedOrder = await Order.create({
    //   ...requestBodyForm,
    //   virtualAccountNo: response.data.vaCode,
    //   paymentId: response.data.merchantTradeNo,
    //   storeId: response.data.storeId,
    //   va: response.data,
    // });

    return { response, result };
};
