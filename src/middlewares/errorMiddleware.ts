import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import { sendCriticalErrorAlert } from "../service/discordService.js";

const errorMiddleware = async (err: Error, req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!err) {
        next();
        return;
    }

    if (err instanceof ResponseError) {
        // `errors` is kept alongside `message` for backward compatibility with
        // older clients; new clients should read `message` and `code`.
        res.status(err.status)
            .json({
                success: false,
                ...(err.code ? { code: err.code } : {}),
                message: err.message,
                errors: err.message,
            })
            .end();
    } else {
        // Log locally
        logger.error(`[500] Unhandled Error at ${req.originalUrl}: ${err.message}`, { stack: err.stack });

        // Fire Discord alert asynchronously (don't await it so we don't block response)
        sendCriticalErrorAlert(req, err).catch((alertErr) => {
            logger.error(`Discord alert failed: ${alertErr.message}`);
        });

        res.status(500)
            .json({
                success: false,
                code: "INTERNAL_SERVER_ERROR",
                message: "Internal Server Error",
                errors: "Internal Server Error",
            })
            .end();
    }
};

export { errorMiddleware };
