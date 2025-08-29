// Mengembalikan bentuk generik utk cron pre-check:
// { status: "PAID" | "PENDING" | "FAILED" | "EXPIRED", paidAt: Date|null, raw: any }

import logger from "../application/logger.js";
import * as qrisService from "../service/qrisService.js";

function isQris(order) {
    const m = (order?.paymentMethod || "").toLowerCase();
    const t = (order?.paymentType || "").toLowerCase();
    return m === "qris" || t === "qris" || Boolean(order?.qris);
}

function normalizeStatus(payload) {
    const raw =
        payload?.status ??
        payload?.paymentStatus ??
        payload?.transactionStatus ??
        payload?.txnStatus ??
        payload?.trx_status ??
        "";

    const s = String(raw).toUpperCase();
    const PAID = ["PAID", "SUCCESS", "SUCCEEDED", "SETTLED", "COMPLETED", "CAPTURED"];
    const PENDING = ["PENDING", "UNPAID", "OPEN", "WAITING", "WAITING_PAYMENT", "PROCESSING"];
    const FAILED = ["FAILED", "DENIED", "REJECTED", "VOIDED", "CANCELED", "CANCELLED", "ERROR"];
    const EXPIRED = ["EXPIRED", "TIMEOUT"];

    if (PAID.includes(s)) return "PAID";
    if (PENDING.includes(s)) return "PENDING";
    if (FAILED.includes(s)) return "FAILED";
    if (EXPIRED.includes(s)) return "EXPIRED";
    return "PENDING";
}

function normalizePaidAt(payload) {
    const cand =
        payload?.paidAt ??
        payload?.paid_at ??
        payload?.settlement_time ??
        payload?.settlementTime ??
        payload?.paid_time ??
        payload?.transaction_time ??
        payload?.transactionTime ??
        payload?.txnTime ??
        null;

    if (!cand) return null;
    const d = new Date(String(cand));
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Ambil status dari provider untuk sebuah order.
 * QRIS: memanggil qrisService.qrisOrderStatus({ id: order._id })
 * NOTE: fungsi ini bisa kamu perluas untuk Paylabs/Xendit/VA lain.
 */
export async function getProviderStatus(order) {
    logger.info("ORDER: ", order);
    // === QRIS ===
    if (isQris(order)) {
        // Sesuai implementasi kamu: param `id` adalah _id dokumen Order
        const { response } = await qrisService.qrisOrderStatus({ id: order._id.toString() });
        const payload = response?.data ?? {};
        if (payload?.errCode && payload.errCode !== "0") {
            return { status: "PENDING", paidAt: null, raw: payload };
        }

        // Paylabs sering taruh detail di data / result
        const detail = payload.data || payload.result || payload;
        return {
            status: normalizeStatus(detail),
            paidAt: normalizePaidAt(detail),
            raw: detail,
        };
    }

    // === Default untuk provider lain (belum diimplement) ===
    return { status: "PENDING", paidAt: null, raw: null };
}
