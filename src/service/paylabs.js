import crypto from "crypto";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import dotenv from "dotenv";
import fs from "fs";
import uuid4 from "uuid4";
import logger from "../application/logger.js";
import { createXenditPaymentLink } from "../controllers/xenditController.js";
import { ResponseError } from "../error/responseError.js";
import { createPaymentLink } from "../service/paymentService.js";
import { getClientPublicKey } from "./clientKeyService.js";

dayjs.extend(utc);
dayjs.extend(timezone);

dotenv.config();
export const paylabsApiUrl = process.env.PAYLABS_API_URL;
export const merchantId = process.env.PAYLABS_MERCHANT_ID;
export const generateRequestId = () => uuid4();
export const generateMerchantTradeNo = () => `PL-${crypto.randomBytes(8).toString("hex")}`;

export const generateUUID12 = () => {
    return String(Math.floor(100000000000 + Math.random() * 900000000000));
};

export const deriveUUID8 = (uuid12) => {
    return uuid12.slice(0, 8);
};

export const generateTimestamp = (offsetMinutes = 0) => {
    return dayjs().add(offsetMinutes, "minute").tz("Asia/Jakarta").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
};

export const generateTimestampSnap = (offsetMinutes = 0) => {
    return dayjs().add(offsetMinutes, "minute").tz("Asia/Jakarta").format("YYYY-MM-DDTHH:mm:ssZ");
};

export const addMinutesToTimestamp = (timestamp, minutes) => {
    return dayjs(timestamp).add(minutes, "minute").tz("Asia/Jakarta").format("YYYY-MM-DDTHH:mm:ssZ");
};

//PAYLABS
// const privateKeyPath = path.join(__dirname, "path/to/your/private_key.pem");
// const privateKey = fs.readFileSync(privateKeyPath, "utf8");

// Function to minify JSON body
export const minifyJson = (body) => {
    if (typeof body !== "object" || body === null) {
        throw new TypeError("Input must be a non-null JSON object");
    }

    // Minify JSON except the `payer` field
    const minified = JSON.stringify(body, (key, value) => {
        if (value === null) return undefined; // Remove null values
        return value;
    });

    // Parse back into an object to process `payer` separately
    const parsed = JSON.parse(minified);
    if (parsed.payer) {
        parsed.payer = body.payer; // Retain original spacing in `payer`
    }

    // Return the final JSON string
    return JSON.stringify(parsed);
};

// Function to create signature
export const createSignature = (httpMethod, endpointUrl, body, timestamp) => {
    if (!httpMethod || !endpointUrl || !body || !timestamp) {
        logger.error("Invalid parameters provided for signature verification");
        return false;
    }

    const minifiedBody = minifyJson(body);
    logger.info(`create minifiedBody (length): ${minifiedBody.length}`);
    logger.info(`create timestamp: ${timestamp}`);

    let privateKey;
    try {
        privateKey = fs.readFileSync("private-key.pem", "utf8");
    } catch (err) {
        logger.error(`Failed to read private key: ${err.message}`);
        return null;
    }

    const hashedBody = crypto.createHash("sha256").update(minifiedBody, "utf8").digest("hex").toLowerCase();

    const stringContent = `${httpMethod}:${endpointUrl}:${hashedBody}:${timestamp}`;
    logger.info(`create stringContent (hashed): ${crypto.createHash("sha256").update(stringContent).digest("hex")}`);

    const sign = crypto.createSign("RSA-SHA256");
    sign.update(stringContent);
    const signature = sign.sign(privateKey, "base64"); // Sign and encode in Base64

    return signature;
};

export const verifySignature = (httpMethod, endpointUrl, rawBody, timestamp, signature) => {
    if (!httpMethod || !endpointUrl || !rawBody || !timestamp || !signature) {
        logger.error("Invalid parameters provided for signature verification");
        return false;
    }

    const minifiedBody = typeof rawBody === "string" ? rawBody.trim() : "";
    logger.info(`verify minifiedBody (length): ${minifiedBody.length}`);
    logger.info(`verify timestamp: ${timestamp}`);

    const hashedBody = crypto.createHash("sha256").update(minifiedBody, "utf8").digest("hex").toLowerCase();

    const stringContent = `${httpMethod}:${endpointUrl}:${hashedBody}:${timestamp}`;
    logger.info(`verify stringContent (hashed): ${crypto.createHash("sha256").update(stringContent).digest("hex")}`);

    let publicKey;
    try {
        publicKey = fs.readFileSync("public.pem", "utf8");
    } catch (err) {
        logger.error(`Failed to read public key: ${err.message}`);
        return false;
    }

    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(stringContent);

    const isVerified = verify.verify(publicKey, Buffer.from(signature, "base64"));
    logger.info(`verify result: ${isVerified}`);

    return isVerified;
};

export const createSignatureForward = (httpMethod, endpointUrl, body, timestamp) => {
    const secret = process.env.SECRET_KEY;
    if (!httpMethod || !endpointUrl || !body || !timestamp) {
        logger.error("Invalid parameters provided for signature verification");
        return false;
    }

    const minifiedBody = minifyJson(body);
    logger.info(`create minifiedBody (length): ${minifiedBody.length}`);
    logger.info(`create timestamp: ${timestamp}`);
    // const privateKey = fs.readFileSync("private-key.pem", "utf8");

    const hashedBody = crypto.createHash("sha256").update(minifiedBody, "utf8").digest("hex").toLowerCase();

    const stringContent = `${httpMethod}:${endpointUrl}:${hashedBody}:${timestamp}`;
    logger.info(`create stringContent (hashed): ${crypto.createHash("sha256").update(stringContent).digest("hex")}`);

    const sign = crypto.createHmac("sha256", secret);
    sign.update(stringContent);
    const signature = sign.digest("base64"); // Sign and encode in Base64

    return signature;
};

export const verifySignatureForward = (httpMethod, endpointUrl, body, timestamp, signature) => {
    const secret = process.env.SECRET_KEY;
    if (!httpMethod || !endpointUrl || !body || !timestamp || !signature) {
        logger.error("Invalid parameters provided for signature verification");
        return false;
    }

    const minifiedBody = minifyJson(body);
    logger.info(`verify minifiedBody (length): ${minifiedBody.length}`);
    logger.info(`verify timestamp: ${timestamp}`);

    const hashedBody = crypto.createHash("sha256").update(minifiedBody, "utf8").digest("hex").toLowerCase();

    const stringContent = `${httpMethod}:${endpointUrl}:${hashedBody}:${timestamp}`;
    logger.info(`verify stringContent (hashed): ${crypto.createHash("sha256").update(stringContent).digest("hex")}`);

    const verify = crypto.createHmac("sha256", secret);
    verify.update(stringContent);

    const expectedSignature = verify.digest("base64");

    const isVerified = signature === expectedSignature;
    logger.info(`verify result: ${isVerified}`);

    return isVerified;
};

const MAX_REQUEST_AGE_MINUTES = 5; // ⏰ Toleransi maksimal 5 menit

export const verifySignatureMiddleware = async (httpMethod, endpointUrl, body, timestamp, signature, clientId) => {
    if (!httpMethod || !endpointUrl || !body || !timestamp || !signature) {
        logger.error("Missing parameters for signature verification");
        return false;
    }

    try {
        const publicKeyPem = await getClientPublicKey(clientId);

        // Normalize HTTP Method
        const normalizedMethod = httpMethod.toUpperCase();

        // Remove query params from URL
        const normalizedUrl = endpointUrl.split("?")[0];

        // Minify and hash the body
        const minifiedBody = minifyJson(body);
        logger.info(`verify minifiedBody (length): ${minifiedBody.length}`);
        logger.info(`minifiedBody: ${minifiedBody}`);
        const hashedBody = crypto.createHash("sha256").update(minifiedBody, "utf8").digest("hex").toLowerCase();

        // Check timestamp freshness
        const requestTime = new Date(timestamp);
        const currentTime = new Date();
        const ageInMinutes = Math.abs((currentTime - requestTime) / (1000 * 60));

        if (isNaN(requestTime.getTime())) {
            logger.error("Invalid timestamp format");
            return false;
        }

        if (ageInMinutes > MAX_REQUEST_AGE_MINUTES) {
            logger.error(`Timestamp too old: ${ageInMinutes.toFixed(2)} minutes`);
            return false;
        }

        logger.info(`Raw data for signing:`, {
            method: normalizedMethod,
            url: normalizedUrl,
            hashedBody,
            timestamp,
        });

        const stringContent = `${normalizedMethod}:${normalizedUrl}:${hashedBody}:${timestamp}`;

        logger.info(`String content for signature verification: ${stringContent}`);
        // logger.info(`Hashed content: ${crypto.createHash("sha256").update(stringContent).digest("hex")}`);

        // Verify signature
        const verify = crypto.createVerify("RSA-SHA256");
        verify.update(stringContent);
        verify.end();

        const isVerified = verify.verify(publicKeyPem, Buffer.from(signature, "base64"));

        logger.info(`Signature verification result: ${isVerified}`);

        if (!isVerified) {
            logger.error(`Signature mismatch for clientId: ${clientId}`);
        }

        return isVerified;
    } catch (error) {
        logger.error(`Error during signature verification: ${error.message}`);
        return false;
    }
};

export const generateCustomerNumber = () => {
    const date = new Date();

    // Format the date as YYYYMMDD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const datePrefix = `${year}${month}${day}`; // e.g., 20241101

    // Generate a cryptographically secure 12-digit random number
    const uniqueNumber = String(parseInt(crypto.randomBytes(6).toString("hex"), 16))
        .padStart(12, "0")
        .slice(0, 12);

    // Combine date prefix with unique number to form a 20-digit customer number
    const customerNumber = `${datePrefix}${uniqueNumber}`;

    return customerNumber;
};

export const generateHeaders = (method, endpoint, requestBody, requestId, offsetMs = 0) => {
    const timestamp = generateTimestamp(offsetMs);
    let signature;
    try {
        signature = createSignature(method, endpoint, requestBody, timestamp);
    } catch (error) {
        logger.error(`❌ Failed to generate signature: ${error.message}`);
        throw new Error("Signature generation failed.");
    }

    return {
        headers: {
            "content-type": "application/json;charset=utf-8",
            "x-timestamp": timestamp,
            "x-signature": signature,
            "x-partner-id": merchantId,
            "x-request-id": requestId,
        },
        timestamp,
    };
};

export const generateHeadersForward = (method, endpoint, requestBody, requestId, offsetMs = 0, clientId) => {
    const timestamp = generateTimestamp(offsetMs);
    const signature = createSignature(method, endpoint, requestBody, timestamp);

    return {
        headers: {
            "Content-Type": "application/json;charset=utf-8",
            "X-TIMESTAMP": timestamp,
            "X-SIGNATURE": signature,
            "X-REQUEST-ID": requestId,
            "X-CLIENT-ID": clientId,
        },
        timestamp,
    };
};

export const handlePaymentLink = async (orderData) => {
    let paymentLink;
    switch (orderData.paymentMethod) {
        case "xendit":
            paymentLink = await createXenditPaymentLink(orderData);
            break;
        case "paylabs":
            paymentLink = await createPaymentLink(orderData);
            break;
        default:
            throw new ResponseError(400, "Payment method not supported");
    }

    if (!paymentLink) throw new ResponseError(400, "Failed to create payment link");

    if (paymentLink.errCode != 0 && orderData.paymentMethod === "paylabs") {
        throw new ResponseError(400, "error, " + paymentLink.errCode);
    }

    const responsePayload = {
        paymentLink: paymentLink.url || paymentLink.invoiceUrl,
        paymentId: paymentLink.id || paymentLink.merchantTradeNo,
    };

    if (paymentLink.storeId) {
        responsePayload.storeId = paymentLink.storeId;
    }

    return responsePayload;
};

export const convertToDate = (paymentExpired) => {
    if (typeof paymentExpired === "string" && paymentExpired.length === 19 && paymentExpired.includes("T")) {
        // ISO 8601 format: 2024-11-08T11:20:45+07:00
        return new Date(paymentExpired);
    } else if (typeof paymentExpired === "string" && paymentExpired.length === 14) {
        // Numerical string format: 20241113094019
        const formattedDate = `${paymentExpired.slice(0, 4)}-${paymentExpired.slice(
            4,
            6,
        )}-${paymentExpired.slice(6, 8)}T${paymentExpired.slice(
            8,
            10,
        )}:${paymentExpired.slice(10, 12)}:${paymentExpired.slice(12)}+07:00`;
        return new Date(formattedDate);
    }
    return null;
};
