import type { Request, Response, NextFunction } from "express";
import logger from "../application/logger.js";
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
