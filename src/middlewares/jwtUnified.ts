import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";

export const jwtUnifiedMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    let token: string | undefined;
    if (req.headers.authorization?.startsWith("Bearer ")) {
        token = req.headers.authorization;
    } else if (req.headers.client === "not-browser") {
        token = req.headers.authorization;
    } else {
        token = req.cookies?.["Authorization"] as string | undefined;
    }

    if (!token) {
        res.status(403).json({
            success: false,
            message: "Unauthorized!",
        });
        return;
    }

    const userToken = token.split(" ")[1];

    try {
        const adminVerified = jwt.verify(userToken, process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY as string) as JwtPayload;
        const adminPayload = adminVerified as Record<string, unknown>;
        req.auth = {
            ...adminVerified,
            role: (adminPayload.role as string) ?? "admin",
            roleId: adminPayload.roleId as string | undefined,
        } as Express.Request["auth"];
        return next();
    } catch (error: unknown) {
        const err = error as Error & { name?: string };
        if (err.name === "TokenExpiredError") {
            logger.error(`Error jwtUnifiedMiddleware: ${err.message}`);
            res.status(401).json({
                success: false,
                message: "Token expired",
            });
            return;
        }
    }

    try {
        const userVerified = jwt.verify(userToken, process.env.ACCESS_TOKEN_PRIVATE_KEY as string) as JwtPayload;
        req.auth = {
            ...userVerified,
            role: ((userVerified as Record<string, unknown>).role as string) ?? "user",
        } as Express.Request["auth"];
        return next();
    } catch (error: unknown) {
        const err = error as Error & { name?: string };
        logger.error(`Error jwtUnifiedMiddleware: ${err.message}`);
        if (err.name === "TokenExpiredError") {
            res.status(401).json({
                success: false,
                message: "Token expired",
            });
            return;
        }
        return next(new ResponseError(400, "Error in the token"));
    }
};
