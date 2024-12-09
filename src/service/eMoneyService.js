import uuid4 from "uuid4";
import { ResponseError } from "../error/responseError.js";
import User from "../models/userModel.js";
import { validateOrderProducts } from "../utils/helper.js";
import { generateHeaders, generateMerchantTradeNo, generateRequestId, merchantId, paylabsApiUrl } from "./paylabs.js";
import { validateEMoneyRefund, validateEMoneyRequest, validateEmoneyStatus } from "../validators/paymentValidator.js";
import axios from "axios";
import Order from "../models/orderModel.js";

export const createEMoney = async ({ validatedProduct, partnerId }) => {
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
        payer: partnerId.name,
        paymentMethod: validatedProduct.paymentMethod,
        paymentType: validatedProduct.paymentType,
        clientId: partnerId.clientId,
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
    const { error } = validateEMoneyRequest(requestBody);
    if (error)
        throw new ResponseError(
            400,
            error.details.map((err) => err.message),
        );

    // Generate headers for Paylabs request
    const { headers } = generateHeaders("POST", "/payment/v2.1/ewallet/create", requestBody, requestId);

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/ewallet/create`, requestBody, { headers });
    // console.log("Response:", response.data);

    // Check for successful response
    if (!response.data || response.data.errCode != 0)
        throw new ResponseError(400, response.data ? `error: ${response.data.errCodeDes}` : "failed to create payment");

    // Save order details in the database
    const result = await Order.create({
        ...requestBodyForm,
        totalAmount: response.data.amount,
        paymentActions: response.data.paymentActions,
        paymentId: response.data.merchantTradeNo,
        paymentExpired: response.data.expiredTime,
        storeId: response.data.storeId,
        eMoney: response.data,
    });

    return { response, result };
};

export const eMoneyOrderStatus = async ({ id }) => {
    // Check if the order exists
    const existOrder = await Order.findById(id);
    if (!existOrder) throw new ResponseError(404, "Order does not exist!");

    if (existOrder.paymentStatus === "paid") throw new ResponseError(409, "Payment already processed!");

    if (existOrder.paymentStatus === "expired") ResponseError(408, "Payment already processed!");

    if (!existOrder.eMoney) throw new ResponseError(400, "E-Money data not found in the order");

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
    const { error } = validateEmoneyStatus(requestBody);
    if (error)
        throw new ResponseError(
            400,
            error.details.map((err) => err.message),
        );

    // Generate headers for Paylabs request
    const { headers } = generateHeaders("POST", "/payment/v2.1/ewallet/query", requestBody, requestId);

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/ewallet/query`, requestBody, { headers });
    // console.log(response.data);

    // Check for successful response
    if (!response.data || response.data.errCode != 0)
        throw new ResponseError(400, response.data ? `error: ${response.data.errCodeDes}` : "failed to create payment");

    // Generate headers for Paylabs request
    const { responseHeaders } = generateHeaders(
        "POST",
        "/api/order/status/ewallet/:id",
        response.data,
        generateRequestId(),
    );

    return { response, responseHeaders };
};

export const refundEmoney = async ({ id, validatedRequest }) => {
    // Check if the order exists
    const existOrder = await Order.findById(id);
    if (!existOrder) throw new ResponseError(404, "Order does not exist!");

    if (!existOrder.paymentPaylabs) throw new ResponseError(400, "Order does not completed!");

    // Check if refund is supported for the payment type
    if (existOrder.paymentType === "OVOBALANCE")
        throw new ResponseError(400, "Refunds are not supported for OVOBALANCE payment type.");

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
    if (error)
        throw new ResponseError(
            400,
            error.details.map((err) => err.message),
        );

    // Generate headers for Paylabs request
    const { headers } = generateHeaders("POST", "/payment/v2.1/ewallet/refund", requestBody, requestId);

    // console.log(requestBody);
    // console.log(headers);

    // Send request to Paylabs
    const response = await axios.post(`${paylabsApiUrl}/payment/v2.1/ewallet/refund`, requestBody, { headers });
    // console.log(response.data);

    // Check for successful response
    if (!response.data || response.data.errCode != 0)
        throw new ResponseError(400, response.data ? `error: ${response.data.errCodeDes}` : "failed to create payment");

    // Generate headers for Paylabs request
    const { responseHeaders } = generateHeaders(
        "POST",
        "/api/order/refund/ewallet/:id",
        response.data,
        generateRequestId(),
    );

    return { response, responseHeaders };
};
