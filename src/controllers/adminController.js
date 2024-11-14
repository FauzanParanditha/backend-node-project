import * as adminService from "../service/adminService.js";
import logger from "../application/logger.js";
import { registerSchema } from "../validators/authValidator.js";

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
    const result = await adminService.getAllAdmins({
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
      message: "All admins",
      data: result.admins,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error(`Error fetching admins: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const register = async (req, res) => {
  const { email, password, fullName } = req.body;

  try {
    const { error } = registerSchema.validate({ email, password, fullName });
    if (error)
      return res
        .status(401)
        .json({ success: false, message: error.details[0].message });

    const admin = await adminService.registerAdmin({
      email,
      password,
      fullName,
    });
    res.status(201).json({ success: true, message: "Registered successfully" });
  } catch (error) {
    logger.error(`Error register: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAdmin = async (req, res) => {
  const { id } = req.params;

  try {
    await adminService.deleteAdminById(id);
    return res.status(200).json({
      success: true,
      message: "Successfully deleted admin",
    });
  } catch (error) {
    logger.error(`Error deleting admin: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
