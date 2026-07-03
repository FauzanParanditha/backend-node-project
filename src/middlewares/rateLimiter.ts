import type { Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import logger from "../application/logger.js";
import { trackSuspiciousActivity } from "../service/blockedIpService.js";

const getVerificationKey = (ip: string | undefined, email: unknown): string => {
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "anonymous";
    return `${ip ?? "unknown"}:${normalizedEmail}`;
};

// Custom limit handler: on top of returning 429, feed the IP suspicion tracker
// so a caller that keeps blowing past a strict auth limiter eventually gets
// IP-blocked. Without this, hammering ONE email is capped at 5 real failed
// logins (5 pts) because attempts 6+ are 429'd before the controller runs, so
// the IP never reaches the 20-pt block threshold. Fires-and-forgets the tracker.
const rateLimitSuspicionHandler =
    (message: string): RequestHandler =>
    (req: Request, res: Response) => {
        if (req.ip) {
            trackSuspiciousActivity(req.ip, {
                type: "RATE_LIMIT",
                metadata: { path: req.originalUrl },
            }).catch((e) => logger.error(`trackSuspicious (rate-limit) error: ${(e as Error).message}`));
        }
        res.status(429).json({ success: false, message });
    };

// Strict limiter for authentication endpoints to prevent brute force.
// Key is IP+email so an attacker probing many different emails from one IP
// cannot exhaust the limit for any single legit user, and a legit user
// behind a shared NAT cannot accidentally lock out their colleagues.
// 5 attempts per 10 minutes per (IP, email) pair is enough for honest
// typo recovery but cuts attacker probe rate by 50% compared to the
// previous IP-only limit of 10.
export const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5,
    keyGenerator: (req) => getVerificationKey(req.ip, req.body?.email),
    handler: rateLimitSuspicionHandler("Too many login attempts, please try again after 10 minutes"),
    standardHeaders: true,
    legacyHeaders: false,
});

// Limiter for order creation to prevent spam/abuse (20 requests per minute)
export const orderLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // Limit each IP to 20 requests per `window`
    message: { success: false, message: "Too many orders created from this IP, please try again after a minute" },
    standardHeaders: true,
    legacyHeaders: false,
});

// Tight limiter for verification code delivery to reduce spam and mailbox abuse
export const verificationSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3,
    keyGenerator: (req) => getVerificationKey(req.ip, req.body?.email),
    message: {
        success: false,
        message: "Too many verification code requests, please try again after 15 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Separate limiter for code submission to slow down OTP brute-force attempts
export const verificationCheckLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10,
    keyGenerator: (req) => getVerificationKey(req.ip, req.body?.email),
    message: {
        success: false,
        message: "Too many verification attempts, please try again after 10 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Reset code delivery should also be throttled to prevent mailbox flooding and account probing
export const forgotPasswordSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3,
    keyGenerator: (req) => getVerificationKey(req.ip, req.body?.email),
    message: {
        success: false,
        message: "Too many forgot password requests, please try again after 15 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Reset code verification gets its own throttle to slow down password reset brute-force
export const forgotPasswordCheckLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10,
    keyGenerator: (req) => getVerificationKey(req.ip, req.body?.email),
    message: {
        success: false,
        message: "Too many forgot password verification attempts, please try again after 10 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
