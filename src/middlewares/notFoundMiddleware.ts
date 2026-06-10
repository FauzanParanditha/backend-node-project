import type { NextFunction, Request, Response } from "express";

// Suspicion tracking for scanner-pattern paths happens earlier in the
// pipeline via suspiciousRequestMiddleware so that probes hitting
// real routes that return 200 (e.g. "/?pum_action=...") are also caught,
// not just the ones that fall through to 404 here.

export const notFoundMiddleware = (_req: Request, res: Response, _next: NextFunction): void => {
    res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Route not found",
        errors: "Route not found",
    });
};
