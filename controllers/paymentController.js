import axios from "axios";
import { createSignature, generateTimestamp } from "../utils/helper.js";
import { validateCreateLinkRequest } from "../validators/paymentValidator.js";
import uuid4 from "uuid4";

export const createPaymentLink = async (order) => {
  try {
    const paylabsApiUrl = process.env.PAYLABS_API_URL;
    const merchantId = process.env.PAYLABS_MERCHANT_ID;
    const timestamp = generateTimestamp();
    const requestId = `req-${uuid4()}`;
    const merchantTradeNo = `merch-${uuid4().substring(0, 32 - 6)}`;

    const requestBody = {
      merchantId: merchantId,
      merchantTradeNo: merchantTradeNo,
      requestId: requestId,
      amount: order.totalAmount,
      phoneNumber: order.phoneNumber,
      productName: order.products.map((p) => p.title).join(", "),
      redirectUrl: "http:localhost:5000",
      // lang: "en",
    };

    // Validate request body using Joi
    const { error } = validateCreateLinkRequest(requestBody);

    if (error) {
      throw new Error(`Payment validation failed: ${error.details[0].message}`);
    }

    // Generate the signature
    const signature = createSignature(
      "POST",
      "/payment/v2.1/h5/createLink",
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

    console.log("headers:", headers);
    console.log("body:", requestBody);

    const { response } = await axios.post(
      `${paylabsApiUrl}/payment/v2.1/h5/createLink`,
      requestBody,
      { headers }
    );

    // const result = {
    //   headers,
    //   requestBody,
    // };

    return response.url;
  } catch (err) {
    throw new Error(`Payment initiation failed: ${err.message}`);
  }
};
