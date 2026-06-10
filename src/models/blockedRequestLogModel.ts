import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface IBlockedRequestLog extends Document {
    ipAddress: string;
    method: string;
    endpoint: string;
    userAgent?: string;
    blockId?: Types.ObjectId;
    createdAt: Date;
}

const blockedRequestLogSchema = new mongoose.Schema<IBlockedRequestLog>(
    {
        ipAddress: { type: String, required: true, index: true },
        method: { type: String, required: true },
        endpoint: { type: String, required: true },
        userAgent: { type: String },
        blockId: { type: mongoose.Schema.Types.ObjectId, ref: "BlockedIP" },
    },
    { timestamps: true },
);

// Compound index for "show me all probes from this IP, newest first" queries.
blockedRequestLogSchema.index({ ipAddress: 1, createdAt: -1 });

// Auto-prune after 30 days so this collection cannot grow without bound under
// a sustained attack. Adjust if forensic retention requirements change.
blockedRequestLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const BlockedRequestLog = mongoose.model<IBlockedRequestLog>(
    "BlockedRequestLog",
    blockedRequestLogSchema,
);
export default BlockedRequestLog;
