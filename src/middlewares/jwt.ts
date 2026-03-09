import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";

export const jwtMiddleware = (req: Request, res: Response, next: NextFunction): void => {
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

    try {
        const userToken = token.split(" ")[1];
        const jwtVerified = jwt.verify(userToken, process.env.ACCESS_TOKEN_PRIVATE_KEY as string) as JwtPayload;
        if (jwtVerified) {
            req.user = jwtVerified as Express.Request["user"];
            next();
        } else {
            throw new ResponseError(400, "Error in the token ");
        }
    } catch (error: unknown) {
        const err = error as Error;
        logger.error(`Error jwtMiddleware: ${err.message}`);
        next(error);
    }
};
