import multer from "multer";
import path, { dirname } from "path";
import pkg from "bcryptjs";
import { createHmac } from "crypto";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
const { hash, compare } = pkg;

export const doHash = (value, saltValue) => {
  const result = hash(value, saltValue);
  return result;
};

export const compareDoHash = (value, hashedValue) => {
  const result = compare(value, hashedValue);
  return result;
};

export const hmacProcess = (value, key) => {
  const result = createHmac("sha256", key).update(value).digest("hex");
  return result;
};

export const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

export const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = fileTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

// Ensure uploads directory exists
export const ensureUploadsDirExists = () => {
  const uploadsDir = path.join(__dirname, "../uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
};

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

export const calculateTotal = (products) => {
  let total = 0;

  products.forEach((product) => {
    const productTotal = product.price * product.quantity;
    const discountAmount = productTotal * (product.discount / 100);
    total += productTotal - discountAmount;
  });

  return total;
};

export const verifySignature = (signature, payload) => {
  const publicKey = fs.readFileSync("public.pem", "utf8");
  const verifier = crypto.createVerify("SHA256");
  verifier.update(payload);
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
};
