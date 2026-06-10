import type { Request, Response, NextFunction } from "express";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import BlockedRequestLog from "../models/blockedRequestLogModel.js";
import {
    blockIp,
    getBlockedIpHistory,
    listBlockedIps,
    unblockIp,
} from "../service/blockedIpService.js";
import { getAdminActivityActor } from "../utils/activityActor.js";

export const listBlocked = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const activeOnly = req.query.activeOnly !== "false";
        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
        const page = Math.max(1, Number(req.query.page) || 1);
        const data = await listBlockedIps({ activeOnly, limit, page });
        return res.status(200).json({ success: true, message: "Blocked IP list", data });
    } catch (error) {
        logger.error(`Error listing blocked IPs: ${(error as Error).message}`);
        next(error);
    }
};

export const getIpHistory = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { ip } = req.params;
    if (!ip) {
        return res.status(400).json({ success: false, message: "IP address is required" });
    }
    try {
        const history = await getBlockedIpHistory(ip);
        return res.status(200).json({ success: true, message: "IP block history", data: history });
    } catch (error) {
        logger.error(`Error getting IP history: ${(error as Error).message}`);
        next(error);
    }
};

export const unblock = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { ip } = req.params;
    const { reason } = req.body ?? {};
    if (!ip) {
        return res.status(400).json({ success: false, message: "IP address is required" });
    }
    if (!reason || typeof reason !== "string") {
        return res.status(400).json({ success: false, message: "Unblock reason is required" });
    }

    try {
        const actor = getAdminActivityActor(req);
        const result = await unblockIp(ip, actor?.actorId ?? null, reason);
        if (!result) {
            throw new ResponseError(404, "No active block found for this IP");
        }
        return res.status(200).json({ success: true, message: "IP unblocked", data: result });
    } catch (error) {
        logger.error(`Error unblocking IP: ${(error as Error).message}`);
        next(error);
    }
};

export const getIpRequestLog = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { ip } = req.params;
    if (!ip) {
        return res.status(400).json({ success: false, message: "IP address is required" });
    }
    try {
        const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
        const items = await BlockedRequestLog.find({ ipAddress: ip })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        return res.status(200).json({ success: true, message: "Blocked request log", data: items });
    } catch (error) {
        logger.error(`Error getting IP request log: ${(error as Error).message}`);
        next(error);
    }
};

export const getIpEndpointStats = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { ip } = req.params;
    if (!ip) {
        return res.status(400).json({ success: false, message: "IP address is required" });
    }
    try {
        // Aggregate unique endpoints + how many times each was probed by this IP.
        // Useful for picking new scanner patterns: paths the attacker tries most.
        const stats = await BlockedRequestLog.aggregate([
            { $match: { ipAddress: ip } },
            {
                $group: {
                    _id: { endpoint: "$endpoint", method: "$method" },
                    count: { $sum: 1 },
                    firstSeen: { $min: "$createdAt" },
                    lastSeen: { $max: "$createdAt" },
                    userAgents: { $addToSet: "$userAgent" },
                },
            },
            { $sort: { count: -1 } },
            { $limit: 200 },
        ]);
        return res.status(200).json({ success: true, message: "Endpoint stats", data: stats });
    } catch (error) {
        logger.error(`Error getting IP endpoint stats: ${(error as Error).message}`);
        next(error);
    }
};

export const forceBlock = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { ip } = req.params;
    const { reason, durationHours, permanent } = req.body ?? {};
    if (!ip) {
        return res.status(400).json({ success: false, message: "IP address is required" });
    }
    if (!reason || typeof reason !== "string") {
        return res.status(400).json({ success: false, message: "Block reason is required" });
    }

    try {
        const actor = getAdminActivityActor(req);
        const durationMs = permanent
            ? undefined
            : durationHours
              ? Number(durationHours) * 60 * 60 * 1000
              : undefined;

        const result = await blockIp({
            ipAddress: ip,
            reason: `MANUAL: ${reason}`,
            blockedBy: actor?.actorId ? (actor.actorId as unknown as never) : undefined,
            durationMs: permanent ? undefined : durationMs,
        });
        return res.status(201).json({ success: true, message: "IP blocked", data: result });
    } catch (error) {
        logger.error(`Error force-blocking IP: ${(error as Error).message}`);
        next(error);
    }
};
