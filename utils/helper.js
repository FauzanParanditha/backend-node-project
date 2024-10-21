import multer from "multer";
import path, { dirname } from "path";
import pkg from "bcryptjs";
import { createHmac } from "crypto";
import { fileURLToPath } from "url";
import fs from "fs";
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
