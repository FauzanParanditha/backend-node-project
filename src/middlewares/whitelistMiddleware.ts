import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import IPWhitelist from "../models/ipWhitelistModel.js";
import { normalizeIP } from "../utils/helper.js";

export const whitelistMiddlewareVerify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        let clientIP = req.ip as string;

        clientIP = normalizeIP(clientIP);

        const whitelistedIP = await IPWhitelist.findOne({
            ipAddress: clientIP,
        });

        if (!whitelistedIP) {
            logger.warn(`Blocked login from IP: ${clientIP}`);
            logger.info(
                JSON.stringify({
                    remote: req.socket.remoteAddress,
                    ip: req.ip,
                    ips: req.ips,
                    forwarded: req.headers["x-forwarded-for"],
                }),
            );

            res.status(403).json({
                success: false,
                message: "Access forbidden",
            });
            return;
        }

        next();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Whitelist middleware error: ${message}`);
        next(error);
    }
};
