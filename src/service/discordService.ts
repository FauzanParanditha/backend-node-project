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
}) => {
    const { ipAddress, reason, offenseCount, blockedUntil, failedAttempts, windowMinutes, emailsTargeted } = params;
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
            { name: "Failed Attempts", value: `${failedAttempts} in ${windowMinutes} minutes`, inline: true },
            { name: "Block Duration", value: durationLabel, inline: false },
            {
                name: "Sample Emails Targeted",
                value: emailsTargeted.length > 0 ? emailsTargeted.slice(0, 10).map((e) => `\`${e}\``).join(", ") : "(none)",
                inline: false,
            },
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
