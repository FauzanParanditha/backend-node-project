import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import { trackSuspiciousActivity } from "../service/blockedIpService.js";
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

// The `cors` middleware rejects unallowed origins by passing an Error whose
// message starts with "Not allowed by CORS". It is a client misuse signal
// (or a scanner), not a server bug.
const isCorsRejection = (err: Error): boolean => /not allowed by cors/i.test(err.message);

// Joi throws a ValidationError (from validateAsync / validate with throwing
// presence) when request payloads fail schema checks. These are client errors
// (400), not server errors — they must not return 500 or page on-call.
const isJoiValidationError = (err: Error & { isJoi?: boolean; name?: string }): boolean =>
    err.isJoi === true || err.name === "ValidationError";

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
    } else if (isJoiValidationError(err)) {
        // Schema validation failure — surface the joi message as a 400 and skip
        // the Discord critical-error alert (these are caller mistakes, not bugs).
        logger.warn(`[400] Validation error at ${req.originalUrl}: ${err.message}`);
        res.status(400)
            .json({
                success: false,
                code: "VALIDATION_ERROR",
                message: err.message,
                errors: err.message,
            })
            .end();
    } else if (isCorsRejection(err)) {
        // Origin not in the CORS allowlist. Treat as 403 and feed the
        // suspicious-activity tracker so persistent scanners get IP-blocked.
        logger.warn(`[403] CORS rejection at ${req.originalUrl} from ${req.ip}: ${err.message}`);
        if (req.ip) {
            trackSuspiciousActivity(req.ip, {
                type: "CORS_REJECTION",
                metadata: { path: req.originalUrl },
            }).catch((e) => logger.error(`trackSuspicious (CORS) error: ${(e as Error).message}`));
        }
        res.status(403)
            .json({
                success: false,
                code: "CORS_REJECTED",
                message: "Origin not allowed",
                errors: "Origin not allowed",
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
