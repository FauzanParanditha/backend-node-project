import * as userService from "../service/userService.js";
import logger from "../application/logger.js";
import { registerSchema } from "../validators/authValidator.js";

export const getAllUser = async (req, res, next) => {
  const {
    query = "",
    limit = 10,
    page = 1,
    sort_by = "_id",
    sort = -1,
    countOnly = false,
  } = req.query;

  try {
    const result = await userService.getAllUsers({
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
      message: "All users",
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error(`Error fetching users: ${error.message}`);
    next(error);
  }
};

export const register = async (req, res, next) => {
  const { email, password, fullName } = req.body;

  try {
    const { error } = registerSchema.validate({ email, password, fullName });
    if (error)
      return res
        .status(401)
        .json({ success: false, message: error.details[0].message });

    const user = await userService.registerUser({
      email,
      password,
      fullName,
    });
    res.status(201).json({ success: true, message: "Registered successfully" });
  } catch (error) {
    logger.error(`Error register: ${error.message}`);
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  const { id } = req.params;

  try {
    await userService.deleteUserById(id);
    return res.status(200).json({
      success: true,
      message: "Successfully deleted user",
    });
  } catch (error) {
    logger.error(`Error deleting user: ${error.message}`);
    next(error);
  }
};
