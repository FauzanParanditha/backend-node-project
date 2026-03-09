import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import logger from "../application/logger.js";
import IPWhitelist from "../models/ipWhitelistModel.js";
import { normalizeIP } from "../utils/helper.js";

export const jwtMiddlewareAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // 🔐 Ambil token HANYA dari Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }

        const token = authHeader.split(" ")[1];

        // 🔑 Verify JWT
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY as string) as JwtPayload;

        // 🌐 Ambil IP client (AMAN karena trust proxy sudah diset)
        let clientIP = req.ip as string;

        clientIP = normalizeIP(clientIP);

        // 🔒 IP Whitelist check
        const whitelistedIP = await IPWhitelist.findOne({
            ipAddress: clientIP,
        });

        if (!whitelistedIP) {
            res.status(403).json({
                success: false,
                message: "Access forbidden",
            });
            return;
        }

        // Inject admin context
        req.admin = decoded as Express.Request["admin"];
        next();
    } catch (error: unknown) {
        const err = error as Error & { name?: string };
        logger.error(`Error jwtMiddlewareAdmin: ${err.message}`);

        if (err.name === "TokenExpiredError") {
            res.status(401).json({
                success: false,
                message: "Token expired",
            });
            return;
        }

        res.status(401).json({
            success: false,
            message: "Invalid token",
        });
    }
};
