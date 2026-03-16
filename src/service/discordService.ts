import axios from "axios";
import logger from "../application/logger.js";

interface DiscordEmbed {
    title: string;
    description: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    timestamp?: string;
}

export const sendDiscordAlert = async (webhookUrl: string | undefined, embed: DiscordEmbed) => {
    if (!webhookUrl) {
        logger.warn("Discord Webhook URL for this specific alert is not configured. Alert skipped.");
        return;
    }

    try {
        await axios.post(webhookUrl, {
            embeds: [
                {
                    ...embed,
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

export const sendPartnerApiErrorAlert = async (partner: string, endpoint: string, errorMsg: string) => {
    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL_API_ERROR, {
        title: `⚠️ PARTNER API ERROR (${partner})`,
        description: `Gagal memanggil fungsi eksternal ke server ${partner}. Kasir klien mungkin terdampak!`,
        color: 16776960, // Yellow
        fields: [
            { name: "Target Endpoint", value: `\`${endpoint}\``, inline: false },
            { name: "Message", value: `\`\`\`\n${errorMsg.substring(0, 800)}\n\`\`\``, inline: false },
        ],
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
