import uuid4 from "uuid4";
import { ResponseError } from "../error/responseError.js";
import { validateOrderProducts } from "../utils/helper.js";
import {
    convertToDate,
    generateHeaders,
    generateMerchantTradeNo,
    generateRequestId,
    merchantId,
    paylabsApiUrl,
} from "./paylabs.js";
import { cancelQrisValidator, validateQrisRequest, validateQrisStatus } from "../validators/paymentValidator.js";
import axios from "axios";
import Order from "../models/orderModel.js";

export const createQris = async ({ validatedProduct }) => {
    // Validate products in the order
    const { validProducts, totalAmount } = await validateOrderProducts(
        validatedProduct.items,
        validatedProduct.paymentType,
        validatedProduct.totalAmount,
    );
    if (!validProducts.length) throw new ResponseError(404, "No valid products found to update the order");

    // Construct order data
    const requestBodyForm = {
        orderId: uuid4(),
        userId: validatedProduct.userId,
        items: validProducts,
        totalAmount,
        phoneNumber: validatedProduct.phoneNumber,
        paymentStatus: "pending",
        payer: validatedProduct.payer,
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
        expire: 300,
        feeType: "OUR",
        productName: requestBodyForm.items.map((p) => p.name).join(", "),
        productInfo: requestBodyForm.items.map((product) => ({
            id: product.id,
            name: product.name,
            price: product.price,
            type: product.type,
            quantity: product.quantity,
        })),
    };

    // Validate requestBody
    const { error } = validateQrisRequest(requestBody);
    if (error)
        throw new ResponseError(
            400,
            error.details.map((err) => err.message),
        );

    // Generate headers for Paylabs request
    const { headers } = generateHeaders("POST", "/payment/v2.1/qris/create", requestBody, requestId);

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/qris/create`, requestBody, { headers });
    // console.log("Response:", response.data);

    // Check for successful response
    if (!response.data || response.data.errCode != 0)
        throw new ResponseError(400, response.data ? `error: ${response.data.errCodeDes}` : "failed to create payment");

    // Save order details in the database
    const result = await Order.create({
        ...requestBodyForm,
        totalAmount: response.data.amount,
        paymentLink: response.data.qrisUrl,
        paymentId: response.data.merchantTradeNo,
        paymentExpired: response.data.expiredTime,
        storeId: response.data.storeId,
        qris: response.data,
    });
    return { response, result };
};

export const qrisOrderStatus = async ({ id }) => {
    // Check if the order exists
    const existOrder = await Order.findById(id);
    if (!existOrder) throw new ResponseError(404, "Order does not exist!");

    if (existOrder.paymentStatus === "paid") throw new ResponseError(409, "Payment already processed!");

    if (existOrder.paymentStatus === "expired") ResponseError(408, "Payment already processed!");

    if (!existOrder.qris) throw new ResponseError(400, "Qris data not found in the order");

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
    const { error } = validateQrisStatus(requestBody);
    if (error)
        throw new ResponseError(
            400,
            error.details.map((err) => err.message),
        );

    // Generate headers for Paylabs request
    const { headers } = generateHeaders("POST", "/payment/v2.1/qris/query", requestBody, requestId);

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/qris/query`, requestBody, { headers });
    // console.log(response.data);

    // Check for successful response
    if (!response.data || response.data.errCode != 0)
        throw new ResponseError(400, response.data ? `error: ${response.data.errCodeDes}` : "failed to create payment");

    // Generate headers for Paylabs request
    const { responseHeaders } = generateHeaders("POST", "/api/order/status/qris/:id", response.data, requestId);

    return { response, responseHeaders };
};

export const cancelQris = async ({ id }) => {
    // Check if the order exists
    const existOrder = await Order.findById(id);
    if (!existOrder) throw new ResponseError(404, "Order does not exist!");

    //check expired
    const currentDateTime = new Date();
    const expiredDateTime = convertToDate(existOrder.paymentExpired);

    if (currentDateTime > expiredDateTime) {
        existOrder.paymentStatus = "expired";
        const payloadResponseError = {
            merchantId: process.env.PAYLABS_MERCHANT_ID,
            requestId: generateRequestId(),
            errCode: "orderExpired",
            errCodeDes: "order expired",
        };
        await existOrder.save();
        return { currentDateTime, expiredDateTime, payloadResponseError };
    }

    if (existOrder.paymentStatus === "paid") throw new ResponseError(409, "Payment already processed!");

    // Prepare request payload for Paylabs
    const requestId = generateRequestId();

    const requestBody = {
        requestId,
        merchantId,
        ...(existOrder.storeId && { storeId: existOrder.storeId }),
        merchantTradeNo: existOrder.paymentId,
        platformTradeNo: existOrder.qris.platformTradeNo,
        qrCode: existOrder.qris.qrCode,
    };

    // console.log(requestBody);

    // Validate requestBody
    const { error } = cancelQrisValidator(requestBody);
    if (error)
        throw new ResponseError(
            400,
            error.details.map((err) => err.message),
        );

    // Generate headers for Paylabs request
    const { headers } = generateHeaders("POST", "/payment/v2.1/qris/cancel", requestBody, requestId);

    // Send request to Paylabs
    const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/qris/cancel`, requestBody, { headers });

    // Check for successful response
    if (!response.data || response.data.errCode != 0)
        throw new ResponseError(400, response.data ? `error: ${response.data.errCodeDes}` : "failed to create payment");

    // Generate headers for Paylabs request
    const { responseHeaders } = generateHeaders(
        "POST",
        "/payment/v2.1/qris/cancel",
        response.data,
        generateRequestId(),
    );

    // Update order details in the database
    existOrder.paymentLink = undefined;
    existOrder.paymentStatus = "cancel";
    existOrder.qris.set(response.data);
    await existOrder.save();

    return { response, responseHeaders };
};
