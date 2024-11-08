import multer from "multer";
import path, { dirname } from "path";
import pkg from "bcryptjs";
import { createHmac } from "crypto";
import { fileURLToPath } from "url";
import fs from "fs";
import Product from "../models/productModel.js";
const { hash, compare } = pkg;

// Define transaction limits
const transactionLimits = {
  POS: { min: 50000, max: 1000000 },
  DANABALANCE: { min: 10000, max: 20000000 },
  OVOBALANCE: { min: 10000, max: 20000000 },
  LINKAJABALANCE: { min: 10000, max: 20000000 },
  SHOPEEBALANCE: { min: 10000, max: 20000000 },
  GOPAYBALANCE: { min: 10000, max: 20000000 },
  Indomaret: { min: 10000, max: 5000000 },
  CreditCard: { min: 10000, max: 100000000 },
  CreditCard_2DSecure: { min: 10000, max: 100000000 },
  CreditCard_6Mos: { min: 10000, max: 100000000 },
  CreditCard_12Mos: { min: 10000, max: 100000000 },
  Indodana: { min: 10000, max: 50000000 },
  Atome: { min: 10000, max: 50000000 },
  Kredivo: { min: 10000, max: 50000000 },
  Alfamart: { min: 10000, max: 2000000 },
  BNIVA: { min: 10000, max: 100000000 },
  BNCVA: { min: 10000, max: 100000000 },
  BTNVA: { min: 10000, max: 100000000 },
  OCBCVA: { min: 10000, max: 100000000 },
  SinarmasVA: { min: 10000, max: 100000000 },
  MandiriVA: { min: 10000, max: 100000000 },
  INAVA: { min: 10000, max: 100000000 },
  PermataVA: { min: 10000, max: 100000000 },
  MaybankVA: { min: 10000, max: 100000000 },
  DanamonVA: { min: 10000, max: 100000000 },
  BRIVA: { min: 10000, max: 100000000 },
  BCAVA: { min: 10000, max: 100000000 },
  MuamalatVA: { min: 10000, max: 100000000 },
  BSIVA: { min: 10000, max: 100000000 },
  CIMBVA: { min: 15000, max: 100000000 },
  QRIS: { min: 1000, max: 10000000 },
  DEFAULT: { min: 10000, max: 100000000 },
};

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

export const calculateTotal = (products) => {
  let total = 0;

  products.forEach((product) => {
    const productTotal = product.price * product.quantity;
    const discountAmount = productTotal * (product.discount / 100);
    total += productTotal - discountAmount;
  });

  return total;
};

export const validateOrderProducts = async (
  products,
  paymentType = "DEFAULT"
) => {
  const validProducts = [];
  let totalAmount = 0;

  // Ensure the payment type has defined transaction limits
  const limits = transactionLimits[paymentType];
  if (!limits) {
    throw new Error(`Unsupported payment type: ${paymentType}`);
  }

  for (const product of products) {
    const foundProduct = await Product.findById(product.productId);
    if (!foundProduct) {
      throw new Error(`Product not found: ${product.productId}`);
    }

    const productTotal = foundProduct.price * product.quantity;
    const discountAmount = productTotal * (product.discount / 100);
    totalAmount += productTotal - discountAmount;

    validProducts.push({
      productId: foundProduct._id,
      title: foundProduct.title,
      price: foundProduct.price,
      discount: foundProduct.discount,
      category: foundProduct.category,
      quantity: product.quantity,
      colors: product.colors.map((c) => ({ color: c })),
      sizes: product.sizes.map((s) => ({ size: s })),
    });
  }

  // Validate totalAmount against the paymentType limits
  if (totalAmount < limits.min || totalAmount > limits.max) {
    throw new Error(
      `Total amount must be between IDR ${limits.min.toLocaleString()} and IDR ${limits.max.toLocaleString()} for ${paymentType} payment method.`
    );
  }

  console.log(validProducts);
  return { validProducts, totalAmount };
};
