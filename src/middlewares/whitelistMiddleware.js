import logger from "../application/logger";
import IPWhitelist from "../models/ipWhitelistModel";

export const whitelistMiddlewareVerify = async (req, res, next) => {
    const clientIP = req.ip;
    // console.log(clientIP);

    try {
        const whitelistedIP = await IPWhitelist.findOne({ ipAddress: clientIP });
        if (!whitelistedIP) {
            return res.status(403).json({
                success: false,
                message: "Access forbidden: Your IP address does not whitelisted.",
            });
        }
        next();
    } catch (error) {
        logger.error(`Error jwtMiddleware: ${error.message}`);
        next(error);
    }
};
