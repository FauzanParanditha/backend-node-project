import rateLimit from "express-rate-limit";

const getVerificationKey = (ip: string | undefined, email: unknown): string => {
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "anonymous";
    return `${ip ?? "unknown"}:${normalizedEmail}`;
};

// Strict limiter for authentication endpints to prevent brute force (5 requests per 10 minutes)
export const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10,
    message: { success: false, message: "Too many login attempts, please try again after 10 minutes" },
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
