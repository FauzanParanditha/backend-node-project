import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import * as adminService from "../service/adminService.js";
import User from "../models/userModel.js";
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
    const { email, password, fullName, role } = req.body;
    const { adminId } = req.admin;

    try {
        const { error } = registerSchema.validate({ email, password, fullName, role });
        if (error) return res.status(400).json({ success: false, message: error.details[0].message });

        await adminService.registerAdmin({
            email,
            password,
            fullName,
            role,
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
        const { role, adminId, userId } = req.auth ?? {};

        if (role === "admin") {
            const admin = await adminService.admin({ id });

            return res.status(200).json({
                success: true,
                message: "admin",
                data: admin,
            });
        }

        if (role === "user") {
            if (!userId) throw new ResponseError(400, "User ID not provided");

            if (id !== userId.toString()) {
                throw new ResponseError(403, "Access forbidden");
            }

            const user = await User.findById(userId);
            if (!user) throw new ResponseError(404, "User does not exist!");

            return res.status(200).json({
                success: true,
                message: "user",
                data: user,
            });
        }

        throw new ResponseError(400, "Role not provided");
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
            return res.status(400).json({
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
        const { role, userId } = req.auth ?? {};

        if (role === "admin" || role === "finance") {
            const dashboard = await adminService.dashboard();

            return res.status(200).json({
                success: true,
                message: "admin",
                data: dashboard,
            });
        }

        if (role === "user") {
            if (!userId) throw new ResponseError(400, "User ID not provided");

            const dashboard = await adminService.dashboardForUser({ userId });

            return res.status(200).json({
                success: true,
                message: "user",
                data: dashboard,
            });
        }

        throw new ResponseError(400, "Role not provided");
    } catch (error) {
        logger.error(`Error fetching dashboard: ${error.message}`);
        next(error);
    }
};

export const dashboardChart = async (req, res, next) => {
    try {
        const { role, userId } = req.auth ?? {};
        const { period = "monthly", date, month, year } = req.query;

        if (!["day", "month", "year", "monthly", "yearly"].includes(period)) {
            throw new ResponseError(400, "Invalid period. Use day, month, year, monthly, or yearly");
        }

        if (role === "admin" || role === "finance") {
            const chart = await adminService.dashboardChart({ period, date, month, year });

            return res.status(200).json({
                success: true,
                message: "admin",
                data: chart,
            });
        }

        if (role === "user") {
            if (!userId) throw new ResponseError(400, "User ID not provided");

            const chart = await adminService.dashboardChartForUser({
                userId,
                period,
                date,
                month,
                year,
            });

            return res.status(200).json({
                success: true,
                message: "user",
                data: chart,
            });
        }

        throw new ResponseError(400, "Role not provided");
    } catch (error) {
        logger.error(`Error fetching dashboard chart: ${error.message}`);
        next(error);
    }
};
