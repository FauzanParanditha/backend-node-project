import type { Request, Response, NextFunction } from "express";
import logger from "../application/logger.js";
import BlockedRequestLog from "../models/blockedRequestLogModel.js";
import { isIpBlocked } from "../service/blockedIpService.js";

export const blockedIpMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip;
    if (!ip) {
        next();
        return;
    }

    try {
        const block = await isIpBlocked(ip);
        if (!block) {
            next();
            return;
        }

        // Fire-and-forget log so we can still see what URLs a blocked IP is
        // probing after the block. apiLogger does not run for blocked IPs
        // (it sits behind this middleware) so without this we lose all
        // post-block visibility into attacker behavior.
        BlockedRequestLog.create({
            ipAddress: ip,
            method: req.method,
            endpoint: req.originalUrl,
            userAgent: req.get("user-agent"),
            blockId: block._id,
        }).catch((e: Error) => logger.error(`BlockedRequestLog write failed: ${e.message}`));

        const until = block.blockedUntil ? new Date(block.blockedUntil).toISOString() : "permanent";
        res.status(403).json({
            success: false,
            code: "IP_BLOCKED",
            message: "Your IP address has been blocked due to suspicious activity.",
            errors: "Your IP address has been blocked due to suspicious activity.",
            details: {
                blockedUntil: until,
                offenseCount: block.offenseCount,
            },
        });
    } catch (err: unknown) {
        // Fail open: if the block check itself errors, do not lock everyone
        // out. Log and let the request through to the normal handlers.
        const error = err as Error;
        logger.error(`blockedIpMiddleware error: ${error.message}`);
        next();
    }
};
