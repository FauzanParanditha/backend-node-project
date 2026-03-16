import mongoose from "mongoose";
import logger from "../application/logger.js";
import Admin from "../models/adminModel.js";
import ActivityLog from "../models/activityLogModel.js";
import User from "../models/userModel.js";

interface LogActivityParams {
    actorId: string | mongoose.Types.ObjectId;
    role: "admin" | "user" | "client" | "finance" | "super_admin";
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

    const logs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).skip(skip).lean().exec();

    const adminActorIds = [
        ...new Set(
            logs
                .filter((item) => item.role === "admin" || item.role === "finance" || item.role === "super_admin")
                .map((item) => item.actorId.toString()),
        ),
    ];
    const userActorIds = [
        ...new Set(logs.filter((item) => item.role === "user" || item.role === "client").map((item) => item.actorId.toString())),
    ];

    const [admins, users] = await Promise.all([
        adminActorIds.length
            ? Admin.find({ _id: { $in: adminActorIds } }).select("email").lean().exec()
            : Promise.resolve([]),
        userActorIds.length ? User.find({ _id: { $in: userActorIds } }).select("email").lean().exec() : Promise.resolve([]),
    ]);

    const actorEmailMap = new Map<string, string>();
    admins.forEach((item) => {
        if (item?._id && item.email) actorEmailMap.set(item._id.toString(), item.email);
    });
    users.forEach((item) => {
        if (item?._id && item.email) actorEmailMap.set(item._id.toString(), item.email);
    });

    const enrichedLogs = logs.map((item) => ({
        ...item,
        email: actorEmailMap.get(item.actorId.toString()) ?? null,
    }));

    const total = await ActivityLog.countDocuments(filter);
    const totalPages = Math.ceil(total / Number(limit));

    return {
        logs: enrichedLogs,
        pagination: {
            totalRecords: total,
            totalPages,
            currentPage: Number(page),
            perPage: Number(limit),
            recordsOnPage: enrichedLogs.length,
        },
    };
};
