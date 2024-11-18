import * as ipWhitelistService from "../service/ipWhitelistService.js";
import logger from "../application/logger.js";
import { ipWhitelistSchema } from "../validators/ipWhitelistValidator.js";

export const ipWhitelists = async (req, res, next) => {
  const {
    query = "",
    limit = 10,
    page = 1,
    sort_by = "_id",
    sort = -1,
    countOnly = false,
  } = req.query;

  try {
    const result = await ipWhitelistService.getAllIpWhitelists({
      query,
      limit,
      page,
      sort_by,
      sort,
      countOnly,
    });

    if (countOnly) {
      return res.status(200).json({ count: result.count });
    }

    return res.status(200).json({
      success: true,
      message: "All ip whitelist",
      data: result.ipWhitelists,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error(`Error fetching ip whitelist: ${error.message}`);
    next(error);
  }
};

export const create = async (req, res, next) => {
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

    const ipWhitelist = await ipWhitelistService.createIpWhitelist({
      adminId,
      ipAddress,
    });

    res.status(201).json({
      success: true,
      message: "Ip address add successfully!",
    });
  } catch (error) {
    logger.error(`Error add ip whitelist: ${error.message}`);
    next(error);
  }
};

export const ipWhitelist = async (req, res, next) => {
  const { id } = req.params;

  try {
    const ipWhitelist = await ipWhitelistService.ipWhitelist({ id });

    return res.status(200).json({
      success: true,
      message: "ip whitelist",
      data: ipWhitelist,
    });
  } catch (error) {
    logger.error(`Error fetching ip whitelist: ${error.message}`);
    next(error);
  }
};

export const updateIpWhitelist = async (req, res, next) => {
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

    const ipWhitelist = await ipWhitelistService.updateIpWhitelist({
      id,
      adminId,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: "Successfully update ip",
    });
  } catch (error) {
    logger.error(`Error update ip address: ${error.message}`);
    next(error);
  }
};

export const deleteIpWhitelist = async (req, res, next) => {
  const { id } = req.params;
  const { adminId } = req.admin;

  try {
    const ipWhitelist = await ipWhitelistService.deleteIpWhitelist({
      id,
      adminId,
    });
    return res.status(200).json({
      success: true,
      message: "Successfully delete ip address",
    });
  } catch (error) {
    logger.error(`Error delete ip address ${error.message}`);
    next(error);
  }
};
