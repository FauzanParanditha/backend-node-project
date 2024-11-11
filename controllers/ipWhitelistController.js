import IPWhitelist from "../models/ipWhitelistModel.js";
import { escapeRegExp } from "../utils/helper.js";
import logger from "../utils/logger.js";
import { ipWhitelistSchema } from "../validators/ipWhitelistValidator.js";

export const ipWhitelists = async (req, res) => {
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
        { ipAddress: { $regex: searchTerm, $options: "i" } },
        //   { status: { $regex: searchTerm, $options: "i" } },
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
      const totalCount = await IPWhitelist.countDocuments(filter);
      return res.status(200).json({ count: totalCount });
    }

    // Fetch orders with pagination and sorting
    const orders = await IPWhitelist.find(filter)
      .sort({ [sortField]: sortValue })
      .limit(limitNum)
      .skip(skip)
      .exec();

    // Calculate pagination details
    const total = await IPWhitelist.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,

      message: "all ip whitelist",
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
    logger.error("Error fetching ip whitelist:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const create = async (req, res) => {
  const { adminId } = req.admin;
  const { ipAddress } = req.body;
  try {
    const { error, value } = ipWhitelistSchema.validate({ ipAddress, adminId });
    if (error) {
      return res.status(401).json({
        success: false,

        message: error.details[0].message,
      });
    }

    const existingIP = await IPWhitelist.findOne({
      ipAddress: ipAddress,
    });
    if (existingIP) {
      return res.status(400).json({
        success: false,
        message: "this ip address is already whitelisted.",
      });
    }

    const newIP = await IPWhitelist.create({
      ipAddress: ipAddress,
      adminId: adminId,
    });
    res.status(201).json({
      success: true,
      message: "ip address added successfully!",
      data: newIP,
    });
  } catch (error) {
    logger.error("Error create ip whitelist:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const ipWhitelist = async (req, res) => {
  try {
    const { id } = req.params;
    const ip = await IPWhitelist.findById(id).populate({
      path: "adminId",
      select: "email",
    });
    if (!ip) {
      return res.status(404).json({
        success: false,
        message: "ip address not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "ip whitelist",
      data: ip,
    });
  } catch (error) {
    logger.error("Error fetching ip whitelist:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateIpWhitelist = async (req, res) => {
  const { id } = req.params;
  const { ipAddress } = req.body;
  const { adminId } = req.admin;

  try {
    const { error, value } = ipWhitelistSchema.validate({ ipAddress, adminId });
    if (error) {
      return res.status(401).json({
        success: false,

        message: error.details[0].message,
      });
    }

    const existIpWhitelist = await IPWhitelist.findOne({ _id: id });
    if (!existIpWhitelist) {
      return res.status(404).json({
        success: false,
        message: "category not found",
      });
    }
    if (existIpWhitelist.adminId.toString() != adminId) {
      return res.status(403).json({
        success: false,
        message: "unatuhorized",
      });
    }

    existIpWhitelist.ipAddress = ipAddress;
    const result = await existIpWhitelist.save();
    return res.status(200).json({
      success: true,
      message: "successfully update ip ",
    });
  } catch (error) {
    logger.error("Error update ip whitelist:", error.message);
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

export const deleteIpWhitelist = async (req, res) => {
  const { id } = req.params;
  const { adminId } = req.admin;

  try {
    const existIpWhitelist = await IPWhitelist.findOne({ _id: id });
    if (!existIpWhitelist) {
      return res.status(404).json({
        success: false,

        message: "ip whitelist not found",
      });
    }
    if (existIpWhitelist.adminId.toString() != adminId) {
      return res.status(403).json({
        success: false,

        message: "unatuhorized",
      });
    }
    await IPWhitelist.deleteOne({ _id: id });
    return res.status(200).json({
      success: true,

      message: "successfully delete ip whitelist",
    });
  } catch (error) {
    logger.error("Error delete ip whitelist", error.message);
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};
