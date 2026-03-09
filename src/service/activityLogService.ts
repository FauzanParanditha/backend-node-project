import mongoose from "mongoose";
import logger from "../application/logger.js";
import ActivityLog from "../models/activityLogModel.js";

interface LogActivityParams {
    actorId: string | mongoose.Types.ObjectId;
    role: "admin" | "user" | "client" | "finance";
    action: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
}

export const logActivity = async ({ actorId, role, action, details, ipAddress }: LogActivityParams): Promise<void> => {
    try {
        await ActivityLog.create({
            actorId: new mongoose.Types.ObjectId(actorId),
            role,
            action,
            details,
            ipAddress,
        });
    } catch (error) {
        logger.error(
            `❌ Error saving Activity log for action ${action}: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
};

export const getActivityLogs = async ({
    limit = 10,
    page = 1,
    role,
    action,
    actorId,
}: {
    limit?: number;
    page?: number;
    role?: string;
    action?: string;
    actorId?: string;
}) => {
    const filter: Record<string, any> = {};

    if (role) filter.role = role;
    if (action) filter.action = action;
    if (actorId) filter.actorId = new mongoose.Types.ObjectId(actorId);

    const skip = (Number(page) - 1) * Number(limit);

    const logs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).skip(skip).exec();

    const total = await ActivityLog.countDocuments(filter);
    const totalPages = Math.ceil(total / Number(limit));

    return {
        logs,
        pagination: {
            totalRecords: total,
            totalPages,
            currentPage: Number(page),
            perPage: Number(limit),
            recordsOnPage: logs.length,
        },
    };
};
