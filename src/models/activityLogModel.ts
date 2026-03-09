import type { Document } from "mongoose";
import mongoose from "mongoose";

export interface IActivityLog extends Document {
    actorId: mongoose.Types.ObjectId;
    role: "admin" | "user" | "client" | "finance";
    action: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    createdAt: Date;
    updatedAt: Date;
}

const activityLogSchema = new mongoose.Schema<IActivityLog>(
    {
        actorId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        role: {
            type: String,
            required: true,
            enum: ["admin", "user", "client", "finance"],
        },
        action: {
            type: String,
            required: true,
        },
        details: {
            type: Object,
        },
        ipAddress: {
            type: String,
        },
    },
    {
        timestamps: true,
    },
);

activityLogSchema.index({ actorId: 1, action: 1 });
activityLogSchema.index({ createdAt: -1 });

const ActivityLog = mongoose.model<IActivityLog>("ActivityLog", activityLogSchema);

export default ActivityLog;
