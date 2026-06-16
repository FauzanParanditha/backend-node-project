import axios from "axios";
import logger from "../application/logger.js";

interface DiscordEmbed {
    title: string;
    description: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    timestamp?: string;
}

const getEnvTag = (): string => {
    const raw = (process.env.APP_ENV || process.env.NODE_ENV || "development").toUpperCase();
    if (raw === "PRODUCTION") return "PROD";
    if (raw === "DEVELOPMENT") return "DEV";
    return raw;
};

export const sendDiscordAlert = async (webhookUrl: string | undefined, embed: DiscordEmbed) => {
    if (!webhookUrl) {
        logger.warn("Discord Webhook URL for this specific alert is not configured. Alert skipped.");
        return;
    }

    const envTag = getEnvTag();

    try {
        await axios.post(webhookUrl, {
            embeds: [
                {
                    ...embed,
                    title: `[${envTag}] ${embed.title}`,
                    timestamp: new Date().toISOString(),
                },
            ],
        });
    } catch (error: any) {
        logger.error(`Failed to send Discord alert: ${error.message}`);
    }
};

export const sendCriticalErrorAlert = async (req: any, error: any) => {
    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_ERROR, {
        title: "🚨 500 Internal Server Error",
        description: `An unhandled exception occurred in the application.`,
        color: 15158332, // Red
        fields: [
            { name: "Endpoint", value: `\`${req.method} ${req.originalUrl}\``, inline: true },
            { name: "IP Address", value: `\`${req.ip}\``, inline: true },
            { name: "Error Message", value: `\`\`\`\n${error.message}\n\`\`\``, inline: false },
            {
                name: "Stack Trace",
                value: `\`\`\`javascript\n${error.stack?.substring(0, 800) || "No stack trace available"}\n\`\`\``,
                inline: false,
            },
        ],
    });
};

export const sendPaymentSuccessAlert = async (orderId: string, method: string, amount: number) => {
    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_REVENUE, {
        title: "💸 HORE! Pembayaran Berhasil Masuk",
        description: `Dana telah aman masuk ke saldo Merchant.`,
        color: 5763719, // Green
        fields: [
            { name: "Order ID", value: `\`${orderId}\``, inline: true },
            { name: "Metode Pembayaran", value: `\`${method}\``, inline: true },
            { name: "Total", value: `**Rp ${amount.toLocaleString("id-ID")}**`, inline: false },
        ],
    });
};

export const sendSecurityAlert = async (type: string, ip: string, details: string) => {
    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_SECURITY, {
        title: `🚨 SECURITY WARNING: ${type}`,
        description: `Sistem mendeteksi aktivitas mencurigakan!`,
        color: 15548997, // Orange
        fields: [
            { name: "Tipe Ancaman", value: `\`${type}\``, inline: false },
            { name: "IP Pelaku", value: `\`${ip || "Unknown"}\``, inline: true },
            { name: "Detail Lengkap", value: `\`\`\`json\n${details.substring(0, 800)}\n\`\`\``, inline: false },
        ],
    });
};

const SENSITIVE_REQUEST_KEYS = new Set(["payer", "phoneNumber", "productInfo", "productName", "notifyUrl"]);

const maskSensitive = (input: Record<string, any>): Record<string, any> => {
    const clone: Record<string, any> = Array.isArray(input) ? [...input] : { ...input };
    for (const key of Object.keys(clone)) {
        if (SENSITIVE_REQUEST_KEYS.has(key)) {
            clone[key] = "[REDACTED]";
        } else if (clone[key] && typeof clone[key] === "object") {
            clone[key] = maskSensitive(clone[key]);
        }
    }
    return clone;
};

const truncateForDiscord = (text: string, max = 800): string =>
    text.length > max ? `${text.substring(0, max)}\n... [truncated]` : text;

export const sendPartnerApiErrorAlert = async (
    partner: string,
    endpoint: string,
    errorMsg: string,
    requestBody?: Record<string, any>,
) => {
    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        { name: "Target Endpoint", value: `\`${endpoint}\``, inline: false },
        { name: "Message", value: `\`\`\`\n${truncateForDiscord(errorMsg)}\n\`\`\``, inline: false },
    ];

    if (requestBody && Object.keys(requestBody).length > 0) {
        const masked = maskSensitive(requestBody);
        const bodyStr = JSON.stringify(masked, null, 2);
        fields.push({
            name: "Request Body",
            value: `\`\`\`json\n${truncateForDiscord(bodyStr)}\n\`\`\``,
            inline: false,
        });
    }

    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_API_ERROR, {
        title: `⚠️ PARTNER API ERROR (${partner})`,
        description: `Gagal memanggil fungsi eksternal ke server ${partner}. Kasir klien mungkin terdampak!`,
        color: 16776960, // Yellow
        fields,
    });
};

export const sendDailySummaryReport = async (
    date: string,
    successCount: number,
    volume: number,
    expiredCount: number,
) => {
    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_REPORT, {
        title: `📈 [REKAP HARIAN] Omzet ${date}`,
        description: `Berikut adalah ringkasan performa Payment Gateway kemarin:`,
        color: 3447003, // Blue
        fields: [
            { name: "Total Transaksi Sukses", value: `**${successCount}x**`, inline: true },
            { name: "Total Volume Uang", value: `**Rp ${volume.toLocaleString("id-ID")}**`, inline: true },
            { name: "Transaksi Batal/Expired", value: `**${expiredCount}x**`, inline: false },
        ],
    });
};

export const sendIpBlockedAlert = async (params: {
    ipAddress: string;
    reason: string;
    offenseCount: number;
    blockedUntil: Date | null;
    failedAttempts: number;
    windowMinutes: number;
    emailsTargeted: string[];
    pathsTargeted?: string[];
}) => {
    const { ipAddress, reason, offenseCount, blockedUntil, failedAttempts, windowMinutes, emailsTargeted, pathsTargeted } = params;
    const durationLabel = blockedUntil
        ? `until ${blockedUntil.toISOString()}`
        : "PERMANENT (requires manual unblock)";
    const offenseLabel = ["1st", "2nd", "3rd"][offenseCount - 1] ?? `${offenseCount}th`;

    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_SECURITY, {
        title: "🚫 IP Auto-Blocked",
        description: `IP address blocked due to suspicious authentication activity (${offenseLabel} offense).`,
        color: 15158332, // Red
        fields: [
            { name: "IP Address", value: `\`${ipAddress}\``, inline: true },
            { name: "Offense Count", value: `\`${offenseCount}\``, inline: true },
            { name: "Reason", value: `\`${reason}\``, inline: false },
            { name: "Suspicious Events", value: `${failedAttempts} points in ${windowMinutes} minutes`, inline: true },
            { name: "Block Duration", value: durationLabel, inline: false },
            ...(emailsTargeted.length > 0
                ? [{
                      name: "Sample Emails Targeted",
                      value: emailsTargeted.slice(0, 10).map((e) => `\`${e}\``).join(", "),
                      inline: false,
                  }]
                : []),
            ...(pathsTargeted && pathsTargeted.length > 0
                ? [{
                      name: "Sample Paths Targeted",
                      value: pathsTargeted.slice(0, 10).map((p) => `\`${p}\``).join(", "),
                      inline: false,
                  }]
                : []),
        ],
    });
};

export const sendDistributedAttackAlert = async (params: {
    email: string;
    distinctIps: string[];
    attempts: number;
    windowSeconds: number;
}) => {
    const { email, distinctIps, attempts, windowSeconds } = params;
    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_SECURITY, {
        title: "🌐 Distributed Brute-Force Attack Detected",
        description: `Multiple IPs are targeting a single account - this looks like a coordinated/botnet attack.`,
        color: 15158332, // Red
        fields: [
            { name: "Target Email", value: `\`${email}\``, inline: true },
            { name: "Distinct IPs", value: `\`${distinctIps.length}\``, inline: true },
            { name: "Total Attempts", value: `\`${attempts}\``, inline: true },
            { name: "Time Window", value: `${windowSeconds}s`, inline: true },
            {
                name: "Sample IPs",
                value: distinctIps.slice(0, 10).map((ip) => `\`${ip}\``).join(", "),
                inline: false,
            },
        ],
    });
};

export const sendAccountLockAlert = async (params: {
    accountType: "admin" | "user";
    email: string;
    attempts: number;
    lockedUntil: number;
    permanent: boolean;
}) => {
    const { accountType, email, attempts, lockedUntil, permanent } = params;
    const durationLabel = permanent
        ? "PERMANENT (requires manual unlock)"
        : `until ${new Date(lockedUntil).toISOString()}`;

    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_SECURITY, {
        title: "🔒 Account Locked",
        description: `An account has been auto-locked after repeated failed login attempts.`,
        color: 16753920, // Orange
        fields: [
            { name: "Account Type", value: `\`${accountType}\``, inline: true },
            { name: "Email", value: `\`${email}\``, inline: true },
            { name: "Failed Attempts", value: `\`${attempts}\``, inline: true },
            { name: "Lock Duration", value: durationLabel, inline: false },
        ],
    });
};

export const sendForceRetryAlert = async (
    callbackId: string,
    adminEmail: string,
    previousRetryCount: number,
    previousErrDesc: string,
) => {
    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_SECURITY, {
        title: "⚠️ FORCE RETRY: Dead Callback Reactivated",
        description: `Admin memaksa retry pada callback yang sudah mencapai batas maksimum.`,
        color: 16753920, // Orange
        fields: [
            { name: "Callback ID", value: `\`${callbackId}\``, inline: true },
            { name: "Admin", value: `\`${adminEmail}\``, inline: true },
            { name: "Previous Retry Count", value: `\`${previousRetryCount}\``, inline: true },
            { name: "Previous Error", value: `\`\`\`\n${previousErrDesc.substring(0, 500) || "(none)"}\n\`\`\``, inline: false },
        ],
    });
};

export const sendAuthAlert = async (status: string, ip: string, email: string, reason: string) => {
    const isSuccess = status.toLowerCase().includes("success");
    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_AUTH, {
        title: `🔐 AUTH LOG: ${status}`,
        description: `Aktivitas autentikasi terdeteksi.`,
        color: isSuccess ? 3066993 : 15158332, // Green / Red
        fields: [
            { name: "Email", value: `\`${email}\``, inline: true },
            { name: "IP Address", value: `\`${ip || "Unknown"}\``, inline: true },
            { name: "Result/Reason", value: reason, inline: false },
        ],
        timestamp: new Date().toISOString(),
    });
};

// ---------------------------------------------------------------------------
// Debounced failed-login alert
// ---------------------------------------------------------------------------
// Failed login attempts from the same IP burst (rate limiter window of 10/10min
// alone meant up to 10 individual Discord messages per IP per window). When
// an attacker is sweeping email dictionaries the AUTH channel drowned in noise
// and real events got lost. This aggregator buffers per-IP attempts for a
// short window and flushes one summary message.

interface PendingAuthEvent {
    status: string;
    email: string;
    reason: string;
    ts: number;
}

interface PendingAuthFlush {
    ip: string;
    events: PendingAuthEvent[];
    timerId: NodeJS.Timeout;
}

const AUTH_FLUSH_DELAY_MS = 30 * 1000; // wait 30s after last event before flush
const AUTH_FLUSH_MAX_EVENTS = 10; // force-flush when we hit 10 in the window

const pendingAuthFlushes = new Map<string, PendingAuthFlush>();

const flushPendingAuth = async (ipKey: string): Promise<void> => {
    const pending = pendingAuthFlushes.get(ipKey);
    if (!pending) return;
    pendingAuthFlushes.delete(ipKey);
    clearTimeout(pending.timerId);

    const count = pending.events.length;
    if (count === 0) return;

    // Single event - send the regular non-aggregated alert so signal/noise
    // is unchanged for low-volume cases.
    if (count === 1) {
        const e = pending.events[0];
        await sendAuthAlert(e.status, pending.ip, e.email, e.reason);
        return;
    }

    const emails = [...new Set(pending.events.map((e) => e.email))];
    const firstTs = pending.events[0].ts;
    const lastTs = pending.events[count - 1].ts;
    const windowSeconds = Math.max(1, Math.round((lastTs - firstTs) / 1000));

    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_AUTH, {
        title: `🔐 AUTH LOG: ${count}x Failed Login (aggregated)`,
        description: `${count} failed login attempts dari satu IP dalam ${windowSeconds}s.`,
        color: 15158332, // Red
        fields: [
            { name: "IP Address", value: `\`${pending.ip}\``, inline: true },
            { name: "Attempts", value: `${count}`, inline: true },
            { name: "Time Window", value: `${windowSeconds}s`, inline: true },
            {
                name: `Unique Emails Targeted (${emails.length})`,
                value: emails.slice(0, 10).map((e) => `\`${e}\``).join(", ") || "(none)",
                inline: false,
            },
            {
                name: "Sample Reason",
                value: pending.events[0].reason.substring(0, 200),
                inline: false,
            },
        ],
    });
};

export const sendAuthAlertDebounced = (status: string, ip: string, email: string, reason: string): void => {
    const safeIp = ip || "Unknown";
    const event: PendingAuthEvent = { status, email, reason, ts: Date.now() };

    let pending = pendingAuthFlushes.get(safeIp);
    if (!pending) {
        pending = {
            ip: safeIp,
            events: [],
            timerId: setTimeout(() => {
                flushPendingAuth(safeIp).catch((e) =>
                    logger.error(`flushPendingAuth error: ${(e as Error).message}`),
                );
            }, AUTH_FLUSH_DELAY_MS),
        };
        pendingAuthFlushes.set(safeIp, pending);
    } else {
        // Reset the timer on each new event so the flush only fires once
        // the burst has gone quiet for AUTH_FLUSH_DELAY_MS.
        clearTimeout(pending.timerId);
        pending.timerId = setTimeout(() => {
            flushPendingAuth(safeIp).catch((e) =>
                logger.error(`flushPendingAuth error: ${(e as Error).message}`),
            );
        }, AUTH_FLUSH_DELAY_MS);
    }

    pending.events.push(event);

    if (pending.events.length >= AUTH_FLUSH_MAX_EVENTS) {
        flushPendingAuth(safeIp).catch((e) =>
            logger.error(`flushPendingAuth error: ${(e as Error).message}`),
        );
    }
};
