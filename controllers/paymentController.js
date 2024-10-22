import axios from "axios";
import { createSignature, generateTimestamp } from "../utils/helper.js";
import { validateCreateLinkRequest } from "../validators/paymentValidator.js";
import uuid4 from "uuid4";

export const createPaymentLink = async (req, res) => {
  // Validate request body using Joi
  const { error } = validateCreateLinkRequest(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  try {
    const paylabsApiUrl = process.env.PAYLABS_API_URL;
    const merchantId = process.env.PAYLABS_MERCHANT_ID;
    const timestamp = generateTimestamp();
    const requestId = `req-${uuid4()}`;
    const merchantTradeNo = `merch-${uuid4()}`;

    const {
      //   merchantId,
      //   merchantTradeNo,
      //   requestId,
      amount,
      phoneNumber,
      productName,
      redirectUrl,
      lang,
      payer,
    } = req.body;

    // Generate the signature
    const signature = createSignature(
      "POST",
      "/payment/v2.1/h5/createLink",
      req.body,
      timestamp
    );

    const headers = {
      "Content-Type": "application/json;charset=utf-8",
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
      "X-PARTNER-ID": merchantId,
      "X-REQUEST-ID": requestId,
    };

    const body = {
      merchantId,
      merchantTradeNo,
      requestId,
      amount,
      phoneNumber,
      productName,
      redirectUrl,
      lang,
      payer,
    };

    const response = await axios.post(
      `${paylabsApiUrl}/payment/v2.1/h5/createLink`,
      body,
      { headers }
    );

    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "An error occured!",
      error: err.message,
    });
  }
};
