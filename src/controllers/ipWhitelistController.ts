import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { logActivity } from "../service/activityLogService.js";
import * as ipWhitelistService from "../service/ipWhitelistService.js";
import { ipWhitelistSchema } from "../validators/ipWhitelistValidator.js";

export const ipWhitelists = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const {
        query = "",
        limit = 10,
        page = 1,
        sort_by = "_id",
        sort = -1,
        countOnly = false,
    } = req.query as Record<string, any>;

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
        logger.error(`Error fetching ip whitelist: ${(error as Error).message}`);
        next(error);
    }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { adminId } = req.admin!;
    const { ipAddress } = req.body;
    try {
        const { error, value } = ipWhitelistSchema.validate({ ipAddress, adminId });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        await ipWhitelistService.createIpWhitelist({
            value,
        });

        logActivity({
            actorId: adminId.toString(),
            role: "admin",
            action: "CREATE_IP_WHITELIST",
            details: { ipAddress },
            ipAddress: req.ip,
        }).catch(console.error);

        res.status(201).json({
            success: true,
            message: "Ip address add successfully!",
        });
    } catch (error) {
        logger.error(`Error add ip whitelist: ${(error as Error).message}`);
        next(error);
    }
};

export const ipWhitelist = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;

    try {
        const ipWhitelist = await ipWhitelistService.ipWhitelist({ id });

        return res.status(200).json({
            success: true,
            message: "ip whitelist",
            data: ipWhitelist,
        });
    } catch (error) {
        logger.error(`Error fetching ip whitelist: ${(error as Error).message}`);
        next(error);
    }
};

export const updateIpWhitelist = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { ipAddress } = req.body;
    const { adminId } = req.admin!;

    try {
        const { error, value } = ipWhitelistSchema.validate({ ipAddress, adminId });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        await ipWhitelistService.updateIpWhitelist({
            id,
            value,
        });

        logActivity({
            actorId: adminId.toString(),
            role: "admin",
            action: "UPDATE_IP_WHITELIST",
            details: { targetIpId: id, newIpAddress: ipAddress },
            ipAddress: req.ip,
        }).catch(console.error);

        return res.status(200).json({
            success: true,
            message: "Successfully update ip",
        });
    } catch (error) {
        logger.error(`Error update ip address: ${(error as Error).message}`);
        next(error);
    }
};

export const deleteIpWhitelist = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { adminId } = req.admin!;

    try {
        await ipWhitelistService.deleteIpWhitelist({
            id,
            adminId,
        });

        logActivity({
            actorId: adminId.toString(),
            role: "admin",
            action: "DELETE_IP_WHITELIST",
            details: { targetIpId: id },
            ipAddress: req.ip,
        }).catch(console.error);

        return res.status(200).json({
            success: true,
            message: "Successfully delete ip address",
        });
    } catch (error) {
        logger.error(`Error delete ip address ${(error as Error).message}`);
        next(error);
    }
};
