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
        res.status(err.status)
            .json({
                success: false,
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
                errors: "Internal Server Error",
            })
            .end();
    }
};

export { errorMiddleware };
