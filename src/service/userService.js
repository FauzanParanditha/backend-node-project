import { ResponseError } from "../error/responseError.js";
import User from "../models/userModel.js";
import { doHash, escapeRegExp } from "../utils/helper.js";

export const getAllUsers = async ({
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
    filter["$or"] = [
      { email: { $regex: searchTerm, $options: "i" } },
      { fullName: { $regex: searchTerm, $options: "i" } },
    ];
  }

  const sortField = sort_by || "_id";
  const sortValue = Number(sort) || -1;
  const limitNum = Number(limit);
  const skip = (Number(page) - 1) * limitNum;

  if (countOnly) {
    return { count: await User.countDocuments(filter) };
  }

  const users = await User.find(filter)
    .sort({ [sortField]: sortValue })
    .limit(limitNum)
    .skip(skip)
    .exec();

  const total = await User.countDocuments(filter);
  const totalPages = Math.ceil(total / limitNum);

  return {
    users,
    pagination: {
      totalRecords: total,
      totalPages,
      currentPage: Number(page),
      perPage: limitNum,
      recordsOnPage: users.length,
    },
  };
};

export const registerUser = async ({ email, password, fullName }) => {
  const existUser = await User.findOne({ email: { $eq: email } });
  if (existUser) throw new ResponseError(400, "User already exists!");

  const hashPassword = await doHash(password, 12);
  const newUser = new User({ email, password: hashPassword, fullName });
  const savedUser = await newUser.save();
  savedUser.password = undefined;
  return savedUser;
};

export const deleteUserById = async (id) => {
  const existUser = await User.findById(id);
  if (!existUser) throw new ResponseError(404, "User does not exist!");
  await User.deleteOne({ _id: id });
  return { success: true, message: "successfully deleted user" };
};
