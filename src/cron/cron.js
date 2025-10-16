import dotenv from "dotenv";
import cron from "node-cron";
import logger from "../application/logger.js";
import Order from "../models/orderModel.js";
import { convertToDate } from "../service/paylabs.js";
import { getProviderStatus } from "../service/paymentStatusService.js";

const TIMEZONE = "Asia/Jakarta";
dotenv.config();

// Window pre-check & grace (ms)
const PRECHECK_WINDOW_MS = parseInt(process.env.PRECHECK_WINDOW_MS || "120000", 10);
const PAYMENT_GRACE_MS = parseInt(process.env.PAYMENT_GRACE_MS || "120000", 10);
const PRECHECK_CALL_TIMEOUT_MS = parseInt(process.env.PRECHECK_CALL_TIMEOUT_MS || "10000", 10);

// Batching / concurrency
const BATCH_PRECHECK = parseInt(process.env.CRON_BATCH_PRECHECK || "3000", 10);
const BATCH_EXPIRE = parseInt(process.env.CRON_BATCH_EXPIRE || "5000", 10);
const BATCH_FALLBACK = parseInt(process.env.CRON_BATCH_FALLBACK || "2000", 10);
const PRECHECK_CONCURRENCY = parseInt(process.env.PRECHECK_CONCURRENCY || "20", 10);

// helper concurrency
async function runInBatches(items, limit, worker) {
    let i = 0;
    const pool = new Set();
    const results = [];
    while (i < items.length || pool.size) {
        while (i < items.length && pool.size < limit) {
            const p = Promise.resolve(worker(items[i])).finally(() => pool.delete(p));
            pool.add(p);
            results.push(p);
            i++;
        }
        await Promise.race(pool);
    }
    return Promise.all(results);
}

// helper timeout
const withTimeout = (p, ms) =>
    Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`precheck timeout after ${ms}ms`)), ms)),
    ]);

// ===== Locks agar tidak overlap antar tick =====
let isPrecheckRunning = false;
let isExpireRunning = false;

// =======================
// 1) PRE-CHECK (tiap 1 menit)
// =======================
cron.schedule(
    "* * * * *",
    async () => {
        if (isPrecheckRunning) {
            logger.warn("[PRECHECK] previous run still running, skip");
            return;
        }
        isPrecheckRunning = true;

        try {
            const now = new Date();
            const end = new Date(now.getTime() + PRECHECK_WINDOW_MS);

            // a) by index
            const upcoming = await Order.find(
                {
                    paymentStatus: "pending",
                    paymentExpiredAt: { $gte: now, $lte: end },
                },
                {
                    orderId: 1,
                    payer: 1,
                    paymentExpiredAt: 1,
                    paymentExpired: 1,
                    paymentMethod: 1,
                    paymentType: 1,
                    qris: 1,
                },
            )
                .limit(BATCH_PRECHECK)
                .lean();

            // b) legacy fallback
            const legacy = await Order.find(
                {
                    paymentStatus: "pending",
                    $or: [{ paymentExpiredAt: null }, { paymentExpiredAt: { $exists: false } }],
                    paymentExpired: { $exists: true, $ne: null },
                },
                { orderId: 1, payer: 1, paymentExpired: 1, paymentMethod: 1, paymentType: 1, qris: 1 },
            )
                .limit(BATCH_FALLBACK)
                .lean();

            const legacyUpcoming = legacy.filter((o) => {
                const exp = convertToDate(o.paymentExpired);
                return exp && exp >= now && exp <= end;
            });

            const candidates = upcoming.concat(legacyUpcoming);

            // ⬇️ LOG DULU, baru decide return
            logger.info(`[PRECHECK] window=${now.toISOString()}..${end.toISOString()} candidates=${candidates.length}`);
            if (!candidates.length) return;

            await runInBatches(candidates, PRECHECK_CONCURRENCY, async (o) => {
                logger.info({
                    tag: "PRECHECK.call",
                    orderId: o.orderId,
                    _id: String(o._id),
                    method: o.paymentMethod,
                    type: o.paymentType,
                });
                try {
                    // ⬇️ timeout guard
                    const status = await withTimeout(getProviderStatus(o), PRECHECK_CALL_TIMEOUT_MS);
                    logger.info({ tag: "PRECHECK.result", orderId: o.orderId, status });

                    if (status?.status !== "PAID") return;

                    const paidAt = status.paidAt ? new Date(status.paidAt) : new Date();
                    const exp = o.paymentExpiredAt ?? convertToDate(o.paymentExpired) ?? new Date(0);
                    const cutoff = new Date(exp.getTime() + PAYMENT_GRACE_MS);

                    let res = await Order.updateOne(
                        { _id: o._id, paymentStatus: "pending" },
                        {
                            $set: {
                                paymentStatus: "paid",
                                providerPaidAt: paidAt,
                                "paymentActions.precheckPaid": true,
                                "paymentActions.precheckCheckedAt": new Date(),
                            },
                        },
                    );

                    if (res.modifiedCount === 0 && paidAt <= cutoff) {
                        res = await Order.updateOne(
                            { _id: o._id, paymentStatus: "expired" },
                            {
                                $set: {
                                    paymentStatus: "paid",
                                    providerPaidAt: paidAt,
                                    "paymentActions.correctedFromExpired": true,
                                    "paymentActions.precheckPaid": true,
                                    "paymentActions.precheckCheckedAt": new Date(),
                                },
                            },
                        );
                    }

                    if (res.modifiedCount > 0) {
                        logger.info(`[PRECHECK→PAID] orderId=${o.orderId} paidAt=${paidAt.toISOString()}`);
                    }
                } catch (e) {
                    logger.error("[PRECHECK] error per order:", o?.orderId, e?.response?.data || e.message);
                }
            });
        } catch (err) {
            logger.error("[CRON precheck] error:", err);
        } finally {
            isPrecheckRunning = false;
        }
    },
    { timezone: TIMEZONE },
);

// =======================
// 2) EXPIRE (tiap 1 menit)
// =======================
cron.schedule(
    "* * * * *",
    async () => {
        if (isExpireRunning) {
            logger.warn("[EXPIRE] previous run still running, skip");
            return;
        }
        isExpireRunning = true;

        const now = new Date();
        try {
            const due = await Order.find({ paymentStatus: "pending", paymentExpiredAt: { $lte: now } }, { _id: 1 })
                .limit(BATCH_EXPIRE)
                .lean();

            const dueIds = due.map((d) => d._id);
            if (dueIds.length) {
                await Order.updateMany(
                    { _id: { $in: dueIds }, paymentStatus: "pending" },
                    { $set: { paymentStatus: "expired" } },
                );

                const expiredDocs = await Order.find(
                    { _id: { $in: dueIds } },
                    { orderId: 1, payer: 1, paymentExpiredAt: 1, paymentExpired: 1, paymentMethod: 1, paymentType: 1 },
                ).lean();

                for (const o of expiredDocs) {
                    const ts = (o.paymentExpiredAt ?? convertToDate(o.paymentExpired))?.toISOString?.();
                    logger.info(`[EXPIRE] orderId=${o.orderId} expiredAt=${ts}`);
                }
            }

            // legacy fallback
            const legacy = await Order.find(
                {
                    paymentStatus: "pending",
                    $or: [{ paymentExpiredAt: null }, { paymentExpiredAt: { $exists: false } }],
                    paymentExpired: { $exists: true, $ne: null },
                },
                { _id: 1, orderId: 1, payer: 1, paymentExpired: 1 },
            )
                .limit(BATCH_FALLBACK)
                .lean();

            const legacyToExpire = [];
            for (const o of legacy) {
                const exp = convertToDate(o.paymentExpired);
                if (exp && exp <= now) legacyToExpire.push(o._id);
            }

            if (legacyToExpire.length) {
                await Order.updateMany(
                    { _id: { $in: legacyToExpire }, paymentStatus: "pending" },
                    { $set: { paymentStatus: "expired" } },
                );

                const expiredLegacy = await Order.find(
                    { _id: { $in: legacyToExpire } },
                    { orderId: 1, payer: 1, paymentExpiredAt: 1, paymentExpired: 1 },
                ).lean();

                for (const o of expiredLegacy) {
                    logger.info(`[EXPIRE] legacy orderId=${o.orderId}`);
                }
            }
        } catch (err) {
            logger.error("[CRON expire] error:", err);
        } finally {
            isExpireRunning = false;
        }
    },
    { timezone: TIMEZONE },
);
