import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import { escapeRegExp } from "../utils/helper.js";
import fs from "fs";
import path, { dirname } from "path";
import { productValidationSchema } from "../validators/productValidator.js";
import { fileURLToPath } from "url";
import logger from "../application/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const products = async (req, res) => {
  const {
    query = "",
    limit = 10,
    page = 1,
    sort_by = "_id",
    sort = -1,
    countOnly = false,
  } = req.query;

  try {
    const filter = {};

    // Parse and handle search term
    if (query.trim()) {
      const searchTerm = escapeRegExp(query.trim());
      filter["$or"] = [{ title: { $regex: searchTerm, $options: "i" } }];
    }

    // Sort and pagination settings
    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum; // Calculate skip based on page number

    if (countOnly) {
      const totalCount = await Product.countDocuments(filter);
      return res.status(200).json({ count: totalCount });
    }

    // Fetch admins with pagination and sorting
    const products = await Product.find(filter)
      .sort({ [sortField]: sortValue })
      .limit(limitNum)
      .skip(skip)
      .populate({
        path: "category",
        select: "name",
      })
      .exec();

    // Calculate pagination details
    const total = await Product.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      message: "all products",
      data: products,
      pagination: {
        totalRecords: total,
        totalPages,
        currentPage: Number(page),
        perPage: limitNum,
        recordsOnPage: products.length,
      },
    });
  } catch (error) {
    logger.error(`Error fetching products: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const createProduct = async (req, res) => {
  const parsedColors = JSON.parse(req.body.colors);
  const parsedSizes = JSON.parse(req.body.sizes);
  const { adminId } = req.admin;
  const { error } = productValidationSchema.validate(
    { ...req.body, colors: parsedColors, sizes: parsedSizes, adminId },
    { abortEarly: false }
  );

  if (error) {
    return res.status(400).json({
      success: false,
      errors: error.details.map((err) => err.message),
    });
  }

  const existCategory = await Category.findOne({ name: req.body.category });
  if (!existCategory) {
    return res.status(404).json({
      success: false,
      message: "category does not exist!",
    });
  }

  // Check if an image was uploaded
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "image is required",
    });
  }

  try {
    const newProduct = new Product({
      title: req.body.title,
      price: req.body.price,
      discount: req.body.discount,
      stock: req.body.stock,
      category: existCategory._id,
      colors: JSON.parse(req.body.colors),
      sizes: JSON.parse(req.body.sizes),
      image: req.file.path,
      description: req.body.description,
      adminId: adminId,
    });

    await newProduct.save();

    return res.status(201).json({
      success: true,
      message: "successfully create product",
    });
  } catch (error) {
    logger.error(`Error create products: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "An error occurred",
      error: error.message,
    });
  }
};

export const product = async (req, res) => {
  const { id } = req.params;

  try {
    const existProduct = await Product.findOne({ _id: id }).populate({
      path: "category",
      select: "name",
    });
    if (!existProduct) {
      return res.status(404).json({
        success: false,
        message: "product not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "product",
      data: existProduct,
    });
  } catch (error) {
    logger.error(`Error fetching product: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProduct = async (req, res) => {
  const { id } = req.params;
  const parsedColors = JSON.parse(req.body.colors);
  const parsedSizes = JSON.parse(req.body.sizes);
  const { adminId } = req.admin;
  const { error } = productValidationSchema.validate(
    { ...req.body, colors: parsedColors, sizes: parsedSizes, adminId },
    { abortEarly: false }
  );

  if (error) {
    return res.status(400).json({
      success: false,
      errors: error.details.map((err) => err.message),
    });
  }

  try {
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "product not found",
      });
    }

    const existCategory = await Category.findOne({ name: req.body.category });
    if (!existCategory) {
      return res.status(404).json({
        success: false,
        message: "category does not exist!",
      });
    }

    if (existingProduct.adminId.toString() != adminId) {
      return res.status(403).json({
        success: false,
        message: "unatuhorized",
      });
    }

    // Prepare the update data
    const updateData = {
      title: req.body.title,
      price: req.body.price,
      discount: req.body.discount,
      stock: req.body.stock,
      category: existCategory._id,
      colors: JSON.parse(req.body.colors),
      sizes: JSON.parse(req.body.sizes),
      description: req.body.description,
    };

    // Handle image upload
    if (req.file) {
      // Delete the old image file if it exists
      const oldImagePath = path.join(__dirname, "../..", existingProduct.image);
      fs.unlink(oldImagePath, (error) => {
        if (error) {
          console.error("Failed to delete old image:", error);
        }
      });

      // Update the image path
      updateData.image = req.file.path; // Use the new image path from multer
    }

    // Update the product
    await Product.findByIdAndUpdate(id, updateData, {
      new: true, // Return the updated document
    });

    return res.status(200).json({
      success: true,
      message: "product updated successfully",
    });
  } catch (error) {
    logger.error(`Error update product: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "An error occurred",
      error: error.message,
    });
  }
};

export const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the product by ID
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "product not found",
      });
    }

    // Delete the associated image file
    const imagePath = path.join(__dirname, "../..", product.image);
    fs.unlink(imagePath, (error) => {
      if (error) {
        console.error("Failed to delete image:", error);
      }
    });

    // Delete the product from the database
    await Product.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "product successfully deleted",
    });
  } catch (error) {
    logger.error(`Error deleting product: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting the product",
      error: error.message,
    });
  }
};
