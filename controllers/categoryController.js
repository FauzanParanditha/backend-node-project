import Category from "../models/categoryModel.js";
import { escapeRegExp } from "../utils/helper.js";
import logger from "../utils/logger.js";
import { categorySchema } from "../validators/categoryValidator.js";

export const categories = async (req, res) => {
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
      filter["$or"] = [{ name: { $regex: searchTerm, $options: "i" } }];
    }

    // Sort and pagination settings
    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum; // Calculate skip based on page number

    if (countOnly) {
      const totalCount = await Category.countDocuments(filter);
      return res.status(200).json({ count: totalCount });
    }

    // Fetch admins with pagination and sorting
    const categories = await Category.find(filter)
      .sort({ [sortField]: sortValue })
      .limit(limitNum)
      .skip(skip)
      .populate({
        path: "adminId",
        select: "email",
      })
      .exec();

    // Calculate pagination details
    const total = await Category.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      message: "all categories",
      data: categories,
      pagination: {
        totalRecords: total,
        totalPages,
        currentPage: Number(page),
        perPage: limitNum,
        recordsOnPage: categories.length,
      },
    });
  } catch (error) {
    logger.error(`Error fetching categories: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const create = async (req, res) => {
  const { name } = req.body;
  const { adminId } = req.admin;

  try {
    const { error, value } = categorySchema.validate({
      name,
      adminId,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const exist = await Category.findOne({ name });
    if (!exist) {
      await Category.create({ name, adminId });
      return res.status(201).json({
        success: true,
        message: "category created successfully!",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `${name} category is already exist`,
      });
    }
  } catch (error) {
    logger.error(`Error post category: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const category = async (req, res) => {
  const { id } = req.params;

  try {
    const existCategory = await Category.findOne({ _id: id }).populate({
      path: "adminId",
      select: "email",
    });
    if (!existCategory) {
      return res.status(404).json({
        success: false,
        message: "category not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "category",
      data: existCategory,
    });
  } catch (error) {
    logger.error(`Error fetching category: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const { adminId } = req.admin;

  try {
    const { error, value } = categorySchema.validate({ name, adminId });
    if (error) {
      return res.status(401).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const existCategory = await Category.findOne({ _id: id });
    if (!existCategory) {
      return res.status(404).json({
        success: false,
        message: "category not found",
      });
    }
    if (existCategory.adminId.toString() != adminId) {
      return res.status(403).json({
        success: false,
        message: "unatuhorized",
      });
    }

    existCategory.name = name;
    const result = await existCategory.save();
    return res.status(200).json({
      success: true,
      message: "successfully update category",
    });
  } catch (error) {
    logger.error(`Error update category: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteCategory = async (req, res) => {
  const { id } = req.params;
  const { adminId } = req.admin;

  try {
    const existCategory = await Category.findOne({ _id: id });
    if (!existCategory) {
      return res.status(404).json({
        success: false,
        message: "category not found",
      });
    }
    if (existCategory.adminId.toString() != adminId) {
      return res.status(403).json({
        success: false,
        message: "unatuhorized",
      });
    }
    await Category.deleteOne({ _id: id });
    return res.status(200).json({
      success: true,
      message: "successfully delete category",
    });
  } catch (error) {
    logger.error(`Error delete category: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
