import logger from "../application/logger.js";
import * as adminService from "../service/adminService.js";
import { registerSchema, updateAdminSchema } from "../validators/authValidator.js";

export const getAllAdmin = async (req, res, next) => {
    const { query = "", limit = 10, page = 1, sort_by = "_id", sort = -1, countOnly = false } = req.query;

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
        next(error);
    }
};

export const register = async (req, res, next) => {
    const { email, password, fullName } = req.body;
    const { adminId } = req.admin;

    try {
        const { error } = registerSchema.validate({ email, password, fullName });
        if (error) return res.status(400).json({ success: false, message: error.details[0].message });

        await adminService.registerAdmin({
            email,
            password,
            fullName,
            adminId,
        });
        res.status(201).json({ success: true, message: "Registered successfully" });
    } catch (error) {
        logger.error(`Error register: ${error.message}`);
        next(error);
    }
};

export const admin = async (req, res, next) => {
    const { id } = req.params;

    try {
        const admin = await adminService.admin({ id });

        return res.status(200).json({
            success: true,
            message: "admin",
            data: admin,
        });
    } catch (error) {
        logger.error(`Error fetching admin: ${error.message}`);
        next(error);
    }
};

export const updateAdmin = async (req, res, next) => {
    const { id } = req.params;
    const { fullName } = req.body;
    const { adminId } = req.admin;

    try {
        const { error, value } = updateAdminSchema.validate({ fullName });
        if (error) {
            return res.status(401).json({
                success: false,
                message: error.details[0].message,
            });
        }

        await adminService.updateAdmin({
            id,
            value,
            adminId,
        });

        return res.status(200).json({
            success: true,
            message: "Successfully update admin",
        });
    } catch (error) {
        logger.error(`Error update admin address: ${error.message}`);
        next(error);
    }
};

export const deleteAdmin = async (req, res, next) => {
    const { id } = req.params;
    const { adminId } = req.admin;

    try {
        await adminService.deleteAdminById(id, adminId);
        return res.status(200).json({
            success: true,
            message: "Successfully deleted admin",
        });
    } catch (error) {
        logger.error(`Error deleting admin: ${error.message}`);
        next(error);
    }
};

export const dashboard = async (req, res, next) => {
    try {
        const dashboard = await adminService.dashboard();

        return res.status(200).json({
            success: true,
            message: "admin",
            data: dashboard,
        });
    } catch (error) {
        logger.error(`Error fetching dashboard: ${error.message}`);
        next(error);
    }
};
