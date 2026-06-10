import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import { sendCriticalErrorAlert } from "../service/discordService.js";

// Body-parser throws these for malformed input from the client. They are
// client errors (400), not server errors (500), and must not page on-call.
const isClientBodyParserError = (err: Error & { type?: string; status?: number }): boolean => {
    if (err instanceof SyntaxError && "body" in err) return true;
    if (err.type === "entity.parse.failed") return true;
    if (err.type === "entity.too.large") return true;
    if (err.type === "encoding.unsupported") return true;
    return false;
};

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
    } else if (isClientBodyParserError(err)) {
        // Client sent malformed JSON, wrong Content-Type, or body too large.
        // Treat as 400 and skip the Discord critical alert so a bad client
        // (or an attacker spraying garbage) cannot flood the alert channel.
        logger.warn(`[400] Malformed request at ${req.originalUrl}: ${err.message}`);
        res.status(400)
            .json({
                success: false,
                code: "MALFORMED_REQUEST",
                message: "Malformed request body",
                errors: "Malformed request body",
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
