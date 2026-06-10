import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { trackSuspiciousActivity } from "../service/blockedIpService.js";

// Paths that legitimate clients of this Node.js service never request.
// Hitting any of these is a strong scanner signal — we feed it to the
// IP block tracker so persistent probers get auto-banned.
const SCANNER_PATTERNS: RegExp[] = [
    /\.php($|[?/])/i,
    /\.aspx?($|[?/])/i,
    /\.jspx?($|[?/])/i,
    /\.cgi($|[?/])/i,
    /\.env($|[?/])/i,
    /\/\.git(\/|$)/i,
    /\/wp-(admin|login|content|includes|json)/i,
    /\/phpmyadmin/i,
    /\/webadmin/i,
    /\/suite-api/i,
    /\/cgi-bin/i,
    /\/xmlrpc/i,
    /\/joomla/i,
    /\/drupal/i,
    /\/typo3/i,
    /\/manager\//i,
    /\/server-status/i,
    /\/_ignition/i,
    /\/actuator\//i,
    /\/console\//i,
    /\/HNAP1/i,
    /\/boaform/i,
    /\/owa\//i,
    /\/ecp\//i,
    /\/vendor\//i,
    /\/struts/i,
    /\/jenkins/i,
];

export const isScannerPath = (path: string): boolean => SCANNER_PATTERNS.some((re) => re.test(path));

export const notFoundMiddleware = (req: Request, res: Response, _next: NextFunction): void => {
    const path = req.originalUrl;

    if (isScannerPath(path) && req.ip) {
        logger.warn(`Scanner path probe from ${req.ip}: ${req.method} ${path}`);
        trackSuspiciousActivity(req.ip, {
            type: "SCANNER_PATH",
            metadata: { path },
        }).catch((e) => logger.error(`trackSuspicious (SCANNER) error: ${(e as Error).message}`));
    }

    res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Route not found",
        errors: "Route not found",
    });
};
