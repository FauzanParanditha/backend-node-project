import Order from "../models/orderModel.js";
import { escapeRegExp } from "../utils/helper.js";

export const orders = async (req, res) => {
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
        { userId: { $regex: searchTerm, $options: "i" } },
        { status: { $regex: searchTerm, $options: "i" } },
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
      const totalCount = await Order.countDocuments(filter);
      return res.status(200).json({ count: totalCount });
    }

    // Fetch orders with pagination and sorting
    const orders = await Order.find(filter)
      .sort({ [sortField]: sortValue })
      .limit(limitNum)
      .skip(skip)
      .exec();

    // Calculate pagination details
    const total = await Order.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      code: 200,
      message: "all orders",
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
    console.error("Error fetching orders:", error.message);
    return res.status(500).json({
      success: false,
      code: 500,
      message: error.message,
    });
  }
};
