import uuid4 from "uuid4";
import User from "../models/userModel.js";
import { calculateTotal, validateOrderProducts } from "../utils/helper.js";
import { orderSchema } from "../validators/orderValidator.js";
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
} from "../utils/paylabs.js";
import {
  validateCreateVA,
  validateGenerateVA,
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
    const { error } = validateCreateVA(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((err) => err.message),
      });
    }

    // Generate request signature
    const signature = createSignature(
      "POST",
      "/v1.0/transfer-va/create-va",
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

    console.log(requestBody);
    console.log(headers);

    // Make API request to Paylabs
    const response = await axios.post(
      `${paylabsApiUrl}/v1.0/transfer-va/create-va`,
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
      partnerServiceId: response.data.virtualAccountData.partnerServiceId,
      customerNo: response.data.virtualAccountData.customerNo,
      virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
      va: response.data,
    });
    res.status(200).json({
      success: true,
      partnerServiceId: response.data.virtualAccountData.partnerServiceId,
      customerNo: response.data.virtualAccountData.customerNo,
      virtualAccountNo: response.data.virtualAccountData.virtualAccountNo,
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
