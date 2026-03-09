import rateLimit from "express-rate-limit";

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
