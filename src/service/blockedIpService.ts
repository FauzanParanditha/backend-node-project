import type { Types } from "mongoose";
import logger from "../application/logger.js";
import BlockedIP from "../models/blockedIpModel.js";
import type { IBlockedIP } from "../models/blockedIpModel.js";
import { sendIpBlockedAlert } from "./discordService.js";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const TRACKER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const TRACKER_THRESHOLD = 20; // points within window -> block
const TRACKER_CLEANUP_MS = 60 * 1000; // sweep stale entries every minute

// Per-event point values. Tuned so 4 scanner hits OR 10 CORS rejections OR
// 20 failed logins (or any mixture) trips the 20-point threshold.
export const SUSPICION_POINTS = {
    FAILED_LOGIN: 1,
    CORS_REJECTION: 2,
    SCANNER_PATH: 5,
} as const;
export type SuspicionType = keyof typeof SUSPICION_POINTS;

// Escalating block durations by offense count.
const BLOCK_DURATIONS_MS: Array<number | null> = [
    1 * 60 * 60 * 1000, // 1st: 1 hour
    6 * 60 * 60 * 1000, // 2nd: 6 hours
    24 * 60 * 60 * 1000, // 3rd: 24 hours
    null, // 4th+: permanent (requires manual unblock)
];

// ---------------------------------------------------------------------------
// In-memory tracker for failed login attempts per IP
// ---------------------------------------------------------------------------

interface IpSuspicionTracker {
    points: number;
    firstSeenAt: number;
    lastSeenAt: number;
    typeCounts: Map<SuspicionType, number>;
    emailsTargeted: Set<string>;
    pathsTargeted: Set<string>;
}

const failTracker = new Map<string, IpSuspicionTracker>();

// Periodic cleanup so old tracker entries do not accumulate.
setInterval(() => {
    const cutoff = Date.now() - TRACKER_WINDOW_MS;
    for (const [ip, entry] of failTracker) {
        if (entry.lastSeenAt < cutoff) failTracker.delete(ip);
    }
}, TRACKER_CLEANUP_MS).unref();

// ---------------------------------------------------------------------------
// In-memory cache of active blocks (synced on block/unblock/expiry)
// ---------------------------------------------------------------------------

const activeBlockCache = new Map<string, IBlockedIP>();

export const refreshBlockCache = async (): Promise<void> => {
    const blocks = await BlockedIP.find({ isActive: true }).lean();
    activeBlockCache.clear();
    for (const b of blocks) {
        activeBlockCache.set(b.ipAddress, b as unknown as IBlockedIP);
    }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const isIpBlocked = async (ip: string): Promise<IBlockedIP | null> => {
    let block = activeBlockCache.get(ip) ?? null;
    if (!block) {
        const doc = await BlockedIP.findOne({ ipAddress: ip, isActive: true }).lean();
        if (doc) {
            block = doc as unknown as IBlockedIP;
            activeBlockCache.set(ip, block);
        }
    }
    if (!block) return null;

    // Lazy expiry: if blockedUntil passed, mark inactive and drop from cache.
    if (block.blockedUntil && new Date(block.blockedUntil).getTime() < Date.now()) {
        await BlockedIP.updateOne(
            { _id: block._id },
            { $set: { isActive: false, unblockedAt: new Date(), unblockReason: "EXPIRED" } },
        );
        activeBlockCache.delete(ip);
        return null;
    }
    return block;
};

interface TrackSuspiciousParams {
    type: SuspicionType;
    metadata?: { email?: string; path?: string };
}

export const trackSuspiciousActivity = async (ip: string, params: TrackSuspiciousParams): Promise<void> => {
    if (!ip) return;
    const now = Date.now();
    const points = SUSPICION_POINTS[params.type];

    let entry = failTracker.get(ip);
    if (entry && now - entry.firstSeenAt > TRACKER_WINDOW_MS) {
        entry = undefined;
    }
    if (!entry) {
        entry = {
            points: 0,
            firstSeenAt: now,
            lastSeenAt: now,
            typeCounts: new Map(),
            emailsTargeted: new Set(),
            pathsTargeted: new Set(),
        };
        failTracker.set(ip, entry);
    }

    entry.points += points;
    entry.lastSeenAt = now;
    entry.typeCounts.set(params.type, (entry.typeCounts.get(params.type) ?? 0) + 1);
    if (params.metadata?.email) entry.emailsTargeted.add(params.metadata.email);
    if (params.metadata?.path) entry.pathsTargeted.add(params.metadata.path);

    if (entry.points >= TRACKER_THRESHOLD) {
        // Snapshot + delete the tracker BEFORE the async blockIp call so
        // concurrent requests cannot pile up and trigger N parallel blocks
        // while we are still awaiting the first one. (Race observed in prod:
        // 19 BlockedIP docs created for the same IP within 46 seconds.)
        const breakdown = Array.from(entry.typeCounts.entries())
            .map(([type, count]) => `${type} x${count}`)
            .join(", ");
        const blockParams = {
            ipAddress: ip,
            reason: `AUTO_SUSPICIOUS: ${breakdown} [${entry.points}pt]`,
            failedAttempts: entry.points,
            windowMinutes: TRACKER_WINDOW_MS / 60000,
            emailsTargeted: Array.from(entry.emailsTargeted),
            pathsTargeted: Array.from(entry.pathsTargeted),
        };
        failTracker.delete(ip);

        await blockIp(blockParams).catch((e) =>
            logger.error(`Failed to auto-block IP ${ip}: ${e.message}`),
        );
    }
};

// Backward-compat wrapper for the existing login controller call site.
export const trackFailedLogin = async (ip: string, email?: string): Promise<void> => {
    return trackSuspiciousActivity(ip, { type: "FAILED_LOGIN", metadata: { email } });
};

interface BlockIpParams {
    ipAddress: string;
    reason: string;
    failedAttempts?: number;
    windowMinutes?: number;
    emailsTargeted?: string[];
    pathsTargeted?: string[];
    blockedBy?: Types.ObjectId; // for manual blocks
    durationMs?: number; // override automatic duration
}

export const blockIp = async (params: BlockIpParams): Promise<IBlockedIP> => {
    // Defense-in-depth: if there is already an active block for this IP, do
    // NOT create a second one. The auto-block path is already guarded by the
    // tracker-delete-before-await pattern, but a parallel manual block call
    // (or a stale tracker entry surviving across restart) could still race.
    const existingActive = await BlockedIP.findOne({ ipAddress: params.ipAddress, isActive: true }).lean();
    if (existingActive) {
        activeBlockCache.set(params.ipAddress, existingActive as unknown as IBlockedIP);
        logger.info(`Skip duplicate block for ${params.ipAddress} (already active offense #${existingActive.offenseCount})`);
        return existingActive as unknown as IBlockedIP;
    }

    const previousOffenses = await BlockedIP.countDocuments({ ipAddress: params.ipAddress });
    const offenseCount = previousOffenses + 1;

    const durationMs =
        params.durationMs ??
        BLOCK_DURATIONS_MS[Math.min(offenseCount, BLOCK_DURATIONS_MS.length) - 1];

    const now = new Date();
    const blockedUntil = durationMs ? new Date(now.getTime() + durationMs) : null;

    const block = await BlockedIP.create({
        ipAddress: params.ipAddress,
        blockedAt: now,
        blockedUntil,
        reason: params.reason,
        offenseCount,
        details: {
            failedAttempts: params.failedAttempts,
            windowMinutes: params.windowMinutes,
            emailsTargeted: params.emailsTargeted,
            pathsTargeted: params.pathsTargeted,
            blockedBy: params.blockedBy?.toString(),
        },
        isActive: true,
    });

    activeBlockCache.set(params.ipAddress, block.toObject() as unknown as IBlockedIP);

    sendIpBlockedAlert({
        ipAddress: params.ipAddress,
        reason: params.reason,
        offenseCount,
        blockedUntil,
        failedAttempts: params.failedAttempts ?? 0,
        windowMinutes: params.windowMinutes ?? 0,
        emailsTargeted: params.emailsTargeted ?? [],
        pathsTargeted: params.pathsTargeted ?? [],
    }).catch((e) => logger.error(`Failed to send IP blocked Discord alert: ${e.message}`));

    logger.warn(`IP auto-blocked: ${params.ipAddress} (offense ${offenseCount}, until ${blockedUntil ?? "permanent"})`);
    return block;
};

export const unblockIp = async (
    ipAddress: string,
    unblockedBy: Types.ObjectId | string | null,
    reason: string,
): Promise<IBlockedIP | null> => {
    const block = await BlockedIP.findOneAndUpdate(
        { ipAddress, isActive: true },
        {
            $set: {
                isActive: false,
                unblockedAt: new Date(),
                unblockedBy: unblockedBy ?? null,
                unblockReason: reason,
            },
        },
        { new: true },
    );

    activeBlockCache.delete(ipAddress);
    failTracker.delete(ipAddress);

    if (block) {
        logger.info(`IP manually unblocked: ${ipAddress} (reason: ${reason})`);
    }
    return block;
};

export const listBlockedIps = async ({
    activeOnly = true,
    limit = 50,
    page = 1,
}: {
    activeOnly?: boolean;
    limit?: number;
    page?: number;
}) => {
    const filter = activeOnly ? { isActive: true } : {};
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        BlockedIP.find(filter).sort({ blockedAt: -1 }).skip(skip).limit(limit).lean(),
        BlockedIP.countDocuments(filter),
    ]);
    return {
        items,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
};

export const getBlockedIpHistory = async (ipAddress: string) => {
    return BlockedIP.find({ ipAddress }).sort({ blockedAt: -1 }).lean();
};
