import crypto from "crypto";
import uuid4 from "uuid4";
import fs from "fs";

export const paylabsApiUrl = process.env.PAYLABS_API_URL;
export const merchantId = process.env.PAYLABS_MERCHANT_ID;
export const generateRequestId = () => uuid4();
export const generateMerchantTradeNo = () =>
  `PL-${crypto.randomBytes(8).toString("hex")}`;

export const generateTimestamp = () => {
  const date = new Date();

  // Get the timezone offset in minutes and convert to hours and minutes (e.g., +07:00)
  const timezoneOffset = -date.getTimezoneOffset(); // Negative because getTimezoneOffset is the opposite of what we need
  const offsetHours = String(Math.floor(timezoneOffset / 60)).padStart(2, "0");
  const offsetMinutes = String(timezoneOffset % 60).padStart(2, "0");
  const offsetSign = timezoneOffset >= 0 ? "+" : "-";

  // Format the date to the desired format (e.g., 2022-09-16T16:58:47.964)
  const isoString = date.toISOString().replace("Z", "");

  // Add the timezone offset to the end (e.g., +07:00)
  const formattedTimestamp = `${isoString}${offsetSign}${offsetHours}:${offsetMinutes}`;

  return formattedTimestamp;
};

//PAYLABS
// const privateKeyPath = path.join(__dirname, "path/to/your/private_key.pem");
// const privateKey = fs.readFileSync(privateKeyPath, "utf8");

// Function to minify JSON body
const minifyJson = (body) => {
  const minified = JSON.stringify(body, (key, value) =>
    value === null ? undefined : value
  );
  return minified.replace(/[\s\n\r\t]+/g, "");
};

// Function to create signature
export const createSignature = (httpMethod, endpointUrl, body, timestamp) => {
  const minifiedBody = minifyJson(body);
  const privateKey = fs.readFileSync("private-key.pem", "utf8");

  const hashedBody = crypto
    .createHash("sha256")
    .update(minifiedBody, "utf8")
    .digest("hex")
    .toLowerCase();
  const stringContent = `${httpMethod}:${endpointUrl}:${hashedBody}:${timestamp}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(stringContent);
  const signature = sign.sign(privateKey, "base64"); // Sign and encode in Base64

  return signature;
};

export const verifySignature = (
  httpMethod,
  endpointUrl,
  body,
  timestamp,
  signature
) => {
  const minifiedBody = minifyJson(body);

  const hashedBody = crypto
    .createHash("sha256")
    .update(minifiedBody, "utf8")
    .digest("hex")
    .toLowerCase();

  const stringContent = `${httpMethod}:${endpointUrl}:${hashedBody}:${timestamp}`;

  const publicKey = fs.readFileSync("public.pem", "utf8");

  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(stringContent);

  const isVerified = verify.verify(publicKey, signature, "base64");

  return isVerified;
};
