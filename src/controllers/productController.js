import { productValidationSchema } from "../validators/productValidator.js";
import * as productService from "../service/productService.js";
import logger from "../application/logger.js";

export const products = async (req, res, next) => {
  const {
    query = "",
    limit = 10,
    page = 1,
    sort_by = "_id",
    sort = -1,
    countOnly = false,
  } = req.query;

  try {
    const product = await productService.getAllProducts({
      query,
      limit,
      page,
      sort_by,
      sort,
      countOnly,
    });

    if (countOnly) {
      return res.status(200).json({ count: product.count });
    }

    return res.status(200).json({
      success: true,
      message: "all products",
      data: product.products,
      pagination: product.pagination,
    });
  } catch (error) {
    logger.error(`Error fetching products: ${error.message}`);
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  const parsedColors = JSON.parse(req.body.colors);
  const parsedSizes = JSON.parse(req.body.sizes);
  const { adminId } = req.admin;

  try {
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

    const product = await productService.createProduct({ req, adminId });

    return res.status(201).json({
      success: true,
      message: "Successfully create product",
    });
  } catch (error) {
    logger.error(`Error create products: ${error.message}`);
    next(error);
  }
};

export const product = async (req, res, next) => {
  const { id } = req.params;

  try {
    const product = await productService.product({ id });
    return res.status(200).json({
      success: true,
      message: "Product",
      data: product,
    });
  } catch (error) {
    logger.error(`Error fetching product: ${error.message}`);
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  const { id } = req.params;
  const parsedColors = JSON.parse(req.body.colors);
  const parsedSizes = JSON.parse(req.body.sizes);
  const { adminId } = req.admin;

  try {
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

    const product = await productService.updateProduct({ id, adminId, req });

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
    });
  } catch (error) {
    logger.error(`Error update product: ${error.message}`);
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  const { id } = req.params;
  const { adminId } = req.admin;

  try {
    const product = await productService.deleteProduct({ id, adminId });

    return res.status(200).json({
      success: true,
      message: "Product successfully deleted",
    });
  } catch (error) {
    logger.error(`Error deleting product: ${error.message}`);
    next(error);
  }
};
