import Admin from "../models/adminModel.js";
import { escapeRegExp } from "../utils/helper.js";
import logger from "../application/logger.js";

export const getAllAdmin = async (req, res) => {
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
      filter["$or"] = [
        { email: { $regex: searchTerm, $options: "i" } },
        { fullName: { $regex: searchTerm, $options: "i" } },
      ];
    }

    // Sort and pagination settings
    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum; // Calculate skip based on page number

    // Connect to DB
    // const m = await connectDB();

    if (countOnly) {
      const totalCount = await Admin.countDocuments(filter);
      return res.status(200).json({ count: totalCount });
    }

    // Fetch admins with pagination and sorting
    const admins = await Admin.find(filter)
      .sort({ [sortField]: sortValue })
      .limit(limitNum)
      .skip(skip)
      .exec();

    // Calculate pagination details
    const total = await Admin.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      message: "all admins",
      data: admins,
      pagination: {
        totalRecords: total,
        totalPages,
        currentPage: Number(page),
        perPage: limitNum,
        recordsOnPage: admins.length,
      },
    });
  } catch (error) {
    logger.error(`Error fetching admins: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteAdmin = async (req, res) => {
  const { id } = req.params;

  try {
    const existAdmin = await Admin.findOne({ _id: id });
    if (!existAdmin) {
      return res.status(404).json({
        success: false,
        message: "admin not found",
      });
    }
    await Admin.deleteOne({ _id: id });
    return res.status(200).json({
      success: true,
      message: "successfully delete admin",
    });
  } catch (error) {
    logger.error(`Error delete admin: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
