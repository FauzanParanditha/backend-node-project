import IPWhitelist from "../models/ipWhitelistModel.js";
import { escapeRegExp } from "../utils/helper.js";

export const getAllIpWhitelists = async ({
  query,
  limit,
  page,
  sort_by,
  sort,
  countOnly,
}) => {
  const filter = {};

  // Apply search term if provided
  if (query && query.trim()) {
    const searchTerm = escapeRegExp(query.trim());
    filter["$or"] = [{ ipAddress: { $regex: searchTerm, $options: "i" } }];
  }

  const sortField = sort_by || "_id";
  const sortValue = Number(sort) || -1;
  const limitNum = Number(limit);
  const skip = (Number(page) - 1) * limitNum;

  if (countOnly) {
    return { count: await IPWhitelist.countDocuments(filter) };
  }

  const ipWhitelists = await IPWhitelist.find(filter)
    .sort({ [sortField]: sortValue })
    .limit(limitNum)
    .skip(skip)
    .populate({
      path: "adminId",
      select: "email",
    })
    .exec();

  const total = await IPWhitelist.countDocuments(filter);
  const totalPages = Math.ceil(total / limitNum);

  return {
    ipWhitelists,
    pagination: {
      totalRecords: total,
      totalPages,
      currentPage: Number(page),
      perPage: limitNum,
      recordsOnPage: ipWhitelists.length,
    },
  };
};

export const createIpWhitelist = async ({ adminId, ipAddress }) => {
  const existIpWhitelist = await IPWhitelist.findOne({ ipAddress });
  if (existIpWhitelist)
    throw new Error(`IpAddress ${ipAddress} already exist!`);

  const newIP = new IPWhitelist({ adminId, ipAddress });
  const result = await newIP.save();

  return result;
};

export const ipWhitelist = async ({ id }) => {
  const result = await IPWhitelist.findOne({ _id: id }).populate({
    path: "adminId",
    select: "email",
  });
  if (!result) throw new Error("IpAddress is not exist!");
  return result;
};

export const updateIpWhitelist = async ({ id, adminId, ipAddress }) => {
  const existIpWhitelist = await IPWhitelist.findOne({ _id: id });
  if (!existIpWhitelist) throw new Error("IpAddress is not exist!");
  if (existIpWhitelist.adminId.toString() != adminId)
    throw new Error("Unauthorized!");
  const existingIpWhitelist = await IPWhitelist.findOne({ ipAddress });
  if (existingIpWhitelist)
    throw new Error(`IpAddress ${ipAddress} already exist!`);

  existIpWhitelist.ipAddress = ipAddress;
  const result = await existIpWhitelist.save();
  return result;
};

export const deleteIpWhitelist = async ({ id, adminId }) => {
  const existIpWhitelist = await IPWhitelist.findOne({ _id: id });
  if (!existIpWhitelist) throw new Error("IpWhitelist is not exist!");

  if (existIpWhitelist.adminId.toString() != adminId)
    throw new Error("Unauthorized!");

  await IPWhitelist.deleteOne({ _id: id });
  return true;
};
