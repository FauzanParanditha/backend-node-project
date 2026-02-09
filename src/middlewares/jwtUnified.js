import jwt from "jsonwebtoken";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";

export const jwtUnifiedMiddleware = (req, res, next) => {
    let token;
    if (req.headers.authorization?.startsWith("Bearer ")) {
        token = req.headers.authorization;
    } else if (req.headers.client === "not-browser") {
        token = req.headers.authorization;
    } else {
        token = req.cookies?.["Authorization"];
    }

    if (!token) {
        return res.status(403).json({
            success: false,
            message: "Unauthorized!",
        });
    }

    const userToken = token.split(" ")[1];

    try {
        const adminVerified = jwt.verify(userToken, process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY);
        req.auth = {
            ...adminVerified,
            role: adminVerified.role ?? "admin",
        };
        return next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            logger.error(`Error jwtUnifiedMiddleware: ${error.message}`);
            return res.status(401).json({
                success: false,
                message: "Token expired",
            });
        }
    }

    try {
        const userVerified = jwt.verify(userToken, process.env.ACCESS_TOKEN_PRIVATE_KEY);
        req.auth = {
            ...userVerified,
            role: userVerified.role ?? "user",
        };
        return next();
    } catch (error) {
        logger.error(`Error jwtUnifiedMiddleware: ${error.message}`);
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Token expired",
            });
        }
        return next(new ResponseError(400, "Error in the token"));
    }
};
