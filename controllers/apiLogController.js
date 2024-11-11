import ApiLog from "../models/apiLogModel.js";
import { escapeRegExp } from "../utils/helper.js";

export const apiLogs = async (req, res) => {
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
      filter["$or"] = [{ endpoint: { $regex: searchTerm, $options: "i" } }];
    }

    // Sort and pagination settings
    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum; // Calculate skip based on page number

    // Connect to DB
    // const m = await connectDB();

    if (countOnly) {
      const totalCount = await ApiLog.countDocuments(filter);
      return res.status(200).json({ count: totalCount });
    }

    // Fetch orders with pagination and sorting
    const orders = await ApiLog.find(filter)
      .sort({ [sortField]: sortValue })
      .limit(limitNum)
      .skip(skip)
      .exec();

    // Calculate pagination details
    const total = await ApiLog.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,

      message: "all api logs",
      data: orders,
      pagination: {
        totalRecords: total,
        totalPages,
        currentPage: Number(page),
        perPage: limitNum,
        recordsOnPage: orders.length,
      },
    });
  } catch (error) {
    logger.error("Error fetching api logs:", error.message);
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};
