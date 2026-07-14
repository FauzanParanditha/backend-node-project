import crypto from "crypto";
import fs from "fs";
import { sendDiscordAlert } from "../service/discordService.js";
import logger from "./logger.js";

// Boot-time configuration validation.
//
// Historically a missing env var or a corrupted key file only surfaced as a
// mystery 500 at request time (e.g. the prod incident where public.pem lost its
// PEM footer during a VM->k8s move, breaking every Paylabs callback). This
// module turns those latent problems into a loud, immediate failure at startup:
// the pod refuses to start and logs exactly what is wrong, so k8s crash-loops
// visibly instead of silently serving errors.

// Env vars that MUST be present for core payment/auth flows to work. Missing any
// of these is fatal (refuse to start).
const REQUIRED_ENV = [
    "MONGODB_URI",
    "SECRET_KEY", // HMAC secret shared with the frontend (verifies "frontend" signer)
    "ACCESS_TOKEN_PRIVATE_KEY", // user JWT signing
    "ACCESS_TOKEN_ADMIN_PRIVATE_KEY", // admin JWT signing
    "HMAC_VERIFICATION_CODE", // verification / reset code hashing
    "PAYLABS_API_URL",
    "PAYLABS_MERCHANT_ID",
    "NOTIFY_URL", // Paylabs -> us callback URL
    "FRONTEND_URL",
] as const;

// Env vars that are important but non-fatal: the app can boot and serve payments
// without them, only the dependent feature (email) degrades. Warn, don't exit.
const RECOMMENDED_ENV = ["MAIL_TOKEN", "MAIL_FORM", "MAIL_ADDRESS", "MAIL_URL", "PORT"] as const;

// PEM key files loaded from the working directory (same paths paylabs.ts uses).
const KEY_FILES: { path: string; kind: "private" | "public"; purpose: string }[] = [
    { path: "private-key.pem", kind: "private", purpose: "outbound Paylabs request signing" },
    { path: "public.pem", kind: "public", purpose: "inbound Paylabs callback verification" },
];

export interface StartupCheckResult {
    ok: boolean;
    fatal: string[];
    warnings: string[];
    envOk: boolean;
    keysOk: boolean;
    checkedAt: string;
}

// Cached result so /healthz can report config health without re-reading files.
let lastResult: StartupCheckResult | null = null;

const validateKeyFile = (file: { path: string; kind: "private" | "public"; purpose: string }): string | null => {
    let pem: string;
    try {
        pem = fs.readFileSync(file.path, "utf8");
    } catch {
        return `Key file "${file.path}" is missing or unreadable (needed for ${file.purpose}).`;
    }
    try {
        if (file.kind === "private") {
            crypto.createPrivateKey(pem);
        } else {
            crypto.createPublicKey(pem);
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Key file "${file.path}" is present but does NOT parse as a valid ${file.kind} key (${message}). Likely a corrupted/flattened PEM — check for the -----BEGIN/END----- lines and real newlines.`;
    }
    return null;
};

export const runStartupChecks = (): StartupCheckResult => {
    const fatal: string[] = [];
    const warnings: string[] = [];

    for (const name of REQUIRED_ENV) {
        if (!process.env[name] || process.env[name]!.trim() === "") {
            fatal.push(`Missing required env var: ${name}`);
        }
    }

    for (const name of RECOMMENDED_ENV) {
        if (!process.env[name] || process.env[name]!.trim() === "") {
            warnings.push(`Missing recommended env var: ${name}`);
        }
    }

    let keysOk = true;
    for (const file of KEY_FILES) {
        const problem = validateKeyFile(file);
        if (problem) {
            fatal.push(problem);
            keysOk = false;
        }
    }

    const envOk = !REQUIRED_ENV.some((n) => !process.env[n] || process.env[n]!.trim() === "");

    const result: StartupCheckResult = {
        ok: fatal.length === 0,
        fatal,
        warnings,
        envOk,
        keysOk,
        checkedAt: new Date().toISOString(),
    };
    lastResult = result;
    return result;
};

// Run checks and exit the process if anything fatal is found. Called once at boot.
export const assertStartupConfigOrExit = async (
    flushAndExit: (code: number) => Promise<void>,
): Promise<void> => {
    const result = runStartupChecks();

    for (const w of result.warnings) logger.warn(`[startup-check] ${w}`);

    if (!result.ok) {
        logger.error("[startup-check] FATAL: configuration invalid, refusing to start:");
        for (const f of result.fatal) logger.error(`[startup-check]   - ${f}`);

        // Proactively notify on-call: a refuse-to-start crash-loops silently in
        // k8s otherwise. Best-effort and time-bounded so a slow/unreachable
        // webhook never delays the exit.
        await Promise.race([
            sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_ERROR, {
                title: "🚨 Backend refused to start (invalid configuration)",
                description:
                    "The backend failed its boot-time config/key check and will crash-loop until fixed. See ONCALL-RUNBOOK §3.",
                color: 15158332, // Red
                fields: [
                    {
                        name: "Problems",
                        value: "```\n" + result.fatal.slice(0, 10).join("\n").substring(0, 900) + "\n```",
                        inline: false,
                    },
                ],
            }).catch(() => undefined),
            new Promise((resolve) => setTimeout(resolve, 4000)),
        ]);

        await flushAndExit(1);
        return;
    }

    logger.info("[startup-check] OK: required env present and Paylabs keys parse successfully.");
};

// Config health snapshot for /healthz (does not re-read key files every call).
export const getConfigHealth = (): { envOk: boolean; keysOk: boolean; checkedAt: string | null } => {
    if (!lastResult) return { envOk: false, keysOk: false, checkedAt: null };
    return { envOk: lastResult.envOk, keysOk: lastResult.keysOk, checkedAt: lastResult.checkedAt };
};
