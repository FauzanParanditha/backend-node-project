import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { trackSuspiciousActivity } from "../service/blockedIpService.js";

// Path-pattern scanner signals. Hitting one of these on a Node.js service
// (no PHP, no Tomcat, no Drupal) is a strong scanner signal regardless of
// the eventual status code.
const PATH_PATTERNS: RegExp[] = [
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

// Query-string scanner signals. These appear in URLs like "/?pum_action=..."
// and would otherwise slip through because the root handler returns 200
// regardless of unknown query params.
const QUERY_PATTERNS: RegExp[] = [
    /[?&]pum_action=/i, // Popup Maker WP plugin probe
    /[?&]wms_capabilities/i, // WMS server probe
    /[?&]gf_page=/i, // Gravity Forms WP plugin
    /[?&]cpmvc_id=/i, // CP Multi-View Calendar WP plugin
    /[?&]wpcf7=/i, // Contact Form 7
    /[?&]wp_action=/i,
    /[?&]wp_lang=/i,
    /[?&]author=\d/i, // WP user enumeration via ?author=N
];

// Recon signals: API documentation endpoints. Hitting these is NOT
// blocked (they may be legitimate developer traffic) but it counts as
// soft suspicion - integrators usually hit them once during onboarding,
// not as part of a broader sweep.
const RECON_PATTERNS: RegExp[] = [
    /^\/swagger\.json/i,
    /^\/api-docs/i,
    /^\/redoc/i,
];

// Exploit attempt signals - path traversal, XSS, command injection, etc.
// Distinct from scanner pattern because intent is exploitation, not recon.
const EXPLOIT_PATTERNS: RegExp[] = [
    /\.\.[\\/]/, // path traversal ../ or ..\
    /%2e%2e[%2f%5c]/i, // url-encoded traversal
    /<script[\s>]/i, // XSS opening tag
    /\bon(error|load|click|mouseover)\s*=/i, // XSS event handler
    /javascript:/i,
    /\bunion\s+select\b/i, // SQL injection
    /\/etc\/passwd/i,
    /\/proc\/self\//i,
    /pearcmd/i, // PHP pear cmd RCE chain
    /eval\(/i,
    /\$\{jndi:/i, // log4shell
];

export const isSuspiciousRequest = (url: string): boolean => {
    return (
        PATH_PATTERNS.some((re) => re.test(url)) ||
        QUERY_PATTERNS.some((re) => re.test(url)) ||
        EXPLOIT_PATTERNS.some((re) => re.test(url))
    );
};

export const isReconRequest = (url: string): boolean => RECON_PATTERNS.some((re) => re.test(url));

export const suspiciousRequestMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
    const url = req.originalUrl;
    if (!req.ip) {
        next();
        return;
    }

    if (isSuspiciousRequest(url)) {
        logger.warn(`Suspicious request from ${req.ip}: ${req.method} ${url}`);
        trackSuspiciousActivity(req.ip, {
            type: "SCANNER_PATH",
            metadata: { path: url },
        }).catch((e) => logger.error(`trackSuspicious (suspiciousRequest) error: ${(e as Error).message}`));
    } else if (isReconRequest(url)) {
        // Soft suspicion - 1pt only. A solo recon hit will not trigger
        // anything; one alongside actual scanner probes raises the score.
        trackSuspiciousActivity(req.ip, {
            type: "RECON_PROBE",
            metadata: { path: url },
        }).catch((e) => logger.error(`trackSuspicious (recon) error: ${(e as Error).message}`));
    }
    next();
};
