import logger from "../application/logger.js";
import IPWhitelist from "../models/ipWhitelistModel.js";
import { normalizeIP } from "../utils/helper.js";

export const whitelistMiddlewareVerify = async (req, res, next) => {
    try {
        const clientIP = req.ip; // 🔥 sudah aman

        clientIP = normalizeIP(clientIP);

        const whitelistedIP = await IPWhitelist.findOne({
            ipAddress: clientIP,
        });

        if (!whitelistedIP) {
            logger.warn(`Blocked login from IP: ${clientIP}`);
            logger.info({
                ip: req.ip,
                ips: req.ips,
                headers: req.headers["x-forwarded-for"],
            });
            return res.status(403).json({
                success: false,
                message: "Access forbidden",
            });
        }

        next();
    } catch (error) {
        logger.error(`Whitelist middleware error: ${error.message}`);
        next(error);
    }
};
