import jwt from "jsonwebtoken";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import IPWhitelist from "../models/ipWhitelistModel.js";

export const jwtMiddlewareAdmin = async (req, res, next) => {
    let token;
    const clientIP = req.headers["x-forwarded-for"] || req.ip;
    // console.log(clientIP);

    if (req.headers.client === "not-browser") {
        token = req.headers.authorization;
    } else {
        token = req.cookies["dsbTkn"] || req.headers.authorization;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized!",
        });
    }

    try {
        const whitelistedIP = await IPWhitelist.findOne({ ipAddress: clientIP });
        if (!whitelistedIP) {
            return res.status(403).json({
                success: false,
                message: "Access forbidden: Your IP address does not whitelisted.",
            });
        }

        if (!token.startsWith("Bearer ")) {
            return next(new ResponseError(403, "Invalid token format."));
        }

        const userToken = token.split(" ")[1];
        const jwtVerified = jwt.verify(userToken, process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY);
        if (jwtVerified) {
            req.admin = jwtVerified;
            next();
        } else {
            throw new ResponseError(400, "Error in the token ");
        }
    } catch (error) {
        logger.error(`Error jwtMiddleware: ${error.message}`);
        next(error);
    }
};
