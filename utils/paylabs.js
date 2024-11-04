import crypto from "crypto";
import uuid4 from "uuid4";
import fs from "fs";

export const paylabsApiUrl = process.env.PAYLABS_API_URL;
export const merchantId = process.env.PAYLABS_MERCHANT_ID;
export const generateRequestId = () => uuid4();
export const generateMerchantTradeNo = () =>
  `PL-${crypto.randomBytes(8).toString("hex")}`;

export const generateUUID12 = () => {
  return String(Math.floor(100000000000 + Math.random() * 900000000000));
};

export const deriveUUID8 = (uuid12) => {
  return uuid12.slice(0, 8);
};

export const generateTimestamp = (offsetMs = 0) => {
  // Create a new Date object and apply the offset if provided
  const date = new Date(Date.now() + offsetMs);

  // Extract date and time components
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  // Get the timezone offset in hours and minutes
  const timezoneOffset = -date.getTimezoneOffset();
  const offsetHours = String(
    Math.floor(Math.abs(timezoneOffset) / 60)
  ).padStart(2, "0");
  const offsetMinutes = String(Math.abs(timezoneOffset) % 60).padStart(2, "0");
  const offsetSign = timezoneOffset >= 0 ? "+" : "-";

  // Include milliseconds only if offsetMs is zero (immediate timestamp generation)
  const milliseconds =
    offsetMs === 0 ? `.${String(date.getMilliseconds()).padStart(3, "0")}` : "";

  // Format the timestamp with or without milliseconds
  const formattedTimestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${milliseconds}${offsetSign}${offsetHours}:${offsetMinutes}`;

  return formattedTimestamp;
};

//PAYLABS
// const privateKeyPath = path.join(__dirname, "path/to/your/private_key.pem");
// const privateKey = fs.readFileSync(privateKeyPath, "utf8");

// Function to minify JSON body
const minifyJson = (body) => {
  if (typeof body !== "object" || body === null) {
    throw new TypeError("Input must be a non-null JSON object");
  }

  const minified = JSON.stringify(body, (key, value) => {
    if (value === null) return undefined; // Remove null values
    if (key === "payer") return value; // Preserve spaces in "payer" field
    return value;
  });

  // Remove whitespace, line breaks, and tabs except within the "payer" field
  return minified.replace(/(\s+|\n|\r|\t)/g, (match, offset, string) => {
    const inPayer = string.slice(0, offset).includes('"payer":');
    return inPayer ? match : "";
  });
};

export default minifyJson;

// Function to create signature
export const createSignature = (httpMethod, endpointUrl, body, timestamp) => {
  const minifiedBody = minifyJson(body);
  console.log(minifiedBody);
  console.log(timestamp);
  const privateKey = fs.readFileSync("private-key.pem", "utf8");

  const hashedBody = crypto
    .createHash("sha256")
    .update(minifiedBody, "utf8")
    .digest("hex")
    .toLowerCase();
  const stringContent = `${httpMethod}:${endpointUrl}:${hashedBody}:${timestamp}`;
  console.log(stringContent);

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

export const generateCustomerNumber = () => {
  const date = new Date();

  // Format the date as YYYYMMDD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const datePrefix = `${year}${month}${day}`; // e.g., 20241101

  // Generate a random 12-digit number for uniqueness
  const uniqueNumber = String(
    Math.floor(100000000000 + Math.random() * 900000000000)
  );

  // Combine date prefix with unique number to form a 20-digit customer number
  const customerNumber = `${datePrefix}${uniqueNumber}`;

  return customerNumber;
};
