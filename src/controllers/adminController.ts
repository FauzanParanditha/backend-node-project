import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import User from "../models/userModel.js";
import { logActivity } from "../service/activityLogService.js";
import * as adminService from "../service/adminService.js";
import { getAdminActivityActor } from "../utils/activityActor.js";
import { isAdminRole } from "../utils/authRole.js";
import { registerSchema, updateAdminSchema } from "../validators/authValidator.js";

export const getAllAdmin = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const {
        query = "",
        limit = 10,
        page = 1,
        sort_by = "_id",
        sort = -1,
        countOnly = false,
    } = req.query as Record<string, any>;

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
        logger.error(`Error fetching admins: ${(error as Error).message}`);
        next(error);
    }
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { email, password, fullName, roleId } = req.body;
    const { adminId } = req.admin!;

    try {
        const { error } = registerSchema.validate({ email, password, fullName, roleId });
        if (error) return res.status(400).json({ success: false, message: error.details[0].message });

        await adminService.registerAdmin({
            email,
            password,
            fullName,
            roleId,
            adminId,
        });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "CREATE_ADMIN",
                details: { newAdminEmail: email, newAdminRoleId: roleId },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        res.status(201).json({ success: true, message: "Registered successfully" });
    } catch (error) {
        logger.error(`Error register: ${(error as Error).message}`);
        next(error);
    }
};

export const admin = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;

    try {
        const { role, adminId: _adminId, userId } = req.auth ?? {};

        if (isAdminRole(role)) {
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
        logger.error(`Error fetching admin: ${(error as Error).message}`);
        next(error);
    }
};

export const updateAdmin = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { fullName } = req.body;
    const { adminId } = req.admin!;

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

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "UPDATE_ADMIN",
                details: { targetAdminId: id },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        return res.status(200).json({
            success: true,
            message: "Successfully update admin",
        });
    } catch (error) {
        logger.error(`Error update admin address: ${(error as Error).message}`);
        next(error);
    }
};

export const deleteAdmin = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { adminId } = req.admin!;

    try {
        await adminService.deleteAdminById(id, adminId);

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "DELETE_ADMIN",
                details: { targetAdminId: id },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        return res.status(200).json({
            success: true,
            message: "Successfully deleted admin",
        });
    } catch (error) {
        logger.error(`Error deleting admin: ${(error as Error).message}`);
        next(error);
    }
};

export const dashboard = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { role, userId } = req.auth ?? {};
        const {
            period,
            startDate,
            endDate,
            clientId,
            status,
            chartPeriod = "monthly",
            chartDate,
            chartMonth,
            chartYear,
            groupBy = "time",
        } = req.query as Record<string, string | undefined>;

        // Validate chart params
        if (!["day", "month", "year", "monthly", "yearly"].includes(chartPeriod)) {
            throw new ResponseError(400, "Invalid chartPeriod. Use day, month, year, monthly, or yearly");
        }
        if (!["time", "client"].includes(groupBy)) {
            throw new ResponseError(400, "Invalid groupBy. Use time or client");
        }

        const dashboardParams = {
            period,
            startDate,
            endDate,
            clientId,
            status,
            chartPeriod,
            chartDate,
            chartMonth,
            chartYear,
            groupBy,
        };

        if (isAdminRole(role)) {
            const result = await adminService.dashboard(dashboardParams);

            return res.status(200).json({
                success: true,
                message: "admin",
                data: result,
            });
        }

        if (role === "user") {
            if (!userId) throw new ResponseError(400, "User ID not provided");

            const result = await adminService.dashboardForUser({ userId, ...dashboardParams });

            return res.status(200).json({
                success: true,
                message: "user",
                data: result,
            });
        }

        throw new ResponseError(400, "Role not provided");
    } catch (error) {
        logger.error(`Error fetching dashboard: ${(error as Error).message}`);
        next(error);
    }
};

// Backward compatibility — redirect to unified dashboard
export const dashboardChart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { role, userId } = req.auth ?? {};
        const {
            period = "monthly",
            date,
            month,
            year,
            clientId,
            groupBy = "time",
            status,
        } = req.query as Record<string, any>;

        if (!["day", "month", "year", "monthly", "yearly"].includes(period)) {
            throw new ResponseError(400, "Invalid period. Use day, month, year, monthly, or yearly");
        }
        if (!["time", "client"].includes(groupBy)) {
            throw new ResponseError(400, "Invalid groupBy. Use time or client");
        }

        if (isAdminRole(role)) {
            const chart = await adminService.dashboardChart({ period, date, month, year, clientId, groupBy, status });

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
                clientId,
                groupBy,
                status,
            });

            return res.status(200).json({
                success: true,
                message: "user",
                data: chart,
            });
        }

        throw new ResponseError(400, "Role not provided");
    } catch (error) {
        logger.error(`Error fetching dashboard chart: ${(error as Error).message}`);
        next(error);
    }
};
