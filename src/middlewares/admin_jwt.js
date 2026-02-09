import jwt from "jsonwebtoken";
import logger from "../application/logger.js";
import IPWhitelist from "../models/ipWhitelistModel.js";
import { normalizeIP } from "../utils/helper.js";

export const jwtMiddlewareAdmin = async (req, res, next) => {
    try {
        // 🔐 Ambil token HANYA dari Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const token = authHeader.split(" ")[1];

        // 🔑 Verify JWT
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY);

        // 🌐 Ambil IP client (AMAN karena trust proxy sudah diset)
        let clientIP = req.ip;

        clientIP = normalizeIP(clientIP);

        // 🔒 IP Whitelist check
        const whitelistedIP = await IPWhitelist.findOne({
            ipAddress: clientIP,
        });

        if (!whitelistedIP) {
            return res.status(403).json({
                success: false,
                message: "Access forbidden",
            });
        }

        // Inject admin context
        req.admin = decoded;
        next();
    } catch (error) {
        logger.error(`Error jwtMiddlewareAdmin: ${error.message}`);

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Token expired",
            });
        }

        return res.status(401).json({
            success: false,
            message: "Invalid token",
        });
    }
};
