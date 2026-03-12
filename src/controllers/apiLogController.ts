import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { getActivityLogs } from "../service/activityLogService.js";
import { isAdminRole } from "../utils/authRole.js";
import * as apiLogService from "../service/apiLogService.js";

export const getAllApiLog = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const {
        query = "",
        limit = 10,
        page = 1,
        sort_by = "_id",
        sort = -1,
        countOnly = false,
    } = req.query as Record<string, any>;

    try {
        const result = await apiLogService.getAllApiLogs({
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
            message: "All api logs",
            data: result.apiLogs,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching api logs: ${(error as Error).message}`);
        next(error);
    }
};

export const getAllEmailLog = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const {
        query = "",
        limit = 10,
        page = 1,
        sort_by = "_id",
        sort = -1,
        countOnly = false,
    } = req.query as Record<string, any>;

    try {
        const result = await apiLogService.getAllEmailLogs({
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
            message: "All email logs",
            data: result.emailLogs,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching email logs: ${(error as Error).message}`);
        next(error);
    }
};

export const getAllCallbackLog = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const {
        query = "",
        limit = 10,
        page = 1,
        sort_by = "_id",
        sort = -1,
        countOnly = false,
    } = req.query as Record<string, any>;

    try {
        const result = await apiLogService.getAllCallbackLogs({
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
            message: "All callback logs",
            data: result.callbackLogs,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching callback logs: ${(error as Error).message}`);
        next(error);
    }
};

export const getAllFailedCallbackLog = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const {
        query = "",
        limit = 10,
        page = 1,
        sort_by = "_id",
        sort = -1,
        countOnly = false,
    } = req.query as Record<string, any>;

    try {
        const result = await apiLogService.getAllFailedCallbackLogs({
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
            message: "All failed callback logs",
            data: result.failedCallbackLogs,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching failed callback logs: ${(error as Error).message}`);
        next(error);
    }
};

export const getAllActivityLog = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { limit = 10, page = 1, role, action, actorId } = req.query as Record<string, any>;
    const { role: requesterRole } = req.admin || {};

    let filterRole = role;

    if (requesterRole && !isAdminRole(requesterRole)) {
        filterRole = requesterRole;
    }

    try {
        const result = await getActivityLogs({
            limit,
            page,
            role: filterRole,
            action,
            actorId,
        });

        return res.status(200).json({
            success: true,
            message: "All activity logs",
            data: result.logs,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching activity logs: ${(error as Error).message}`);
        next(error);
    }
};
