import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface IBlockedIP extends Document {
    ipAddress: string;
    blockedAt: Date;
    blockedUntil: Date | null;
    reason: string;
    offenseCount: number;
    details?: Record<string, unknown>;
    isActive: boolean;
    unblockedAt?: Date | null;
    unblockedBy?: Types.ObjectId | null;
    unblockReason?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const blockedIpSchema = new mongoose.Schema<IBlockedIP>(
    {
        ipAddress: { type: String, required: true, index: true },
        blockedAt: { type: Date, required: true },
        blockedUntil: { type: Date, default: null },
        reason: { type: String, required: true },
        offenseCount: { type: Number, required: true, default: 1 },
        details: { type: Object },
        isActive: { type: Boolean, required: true, default: true, index: true },
        unblockedAt: { type: Date, default: null },
        unblockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
        unblockReason: { type: String, default: null },
    },
    { timestamps: true },
);

blockedIpSchema.index({ ipAddress: 1, isActive: 1 });

const BlockedIP = (mongoose.models.BlockedIP as mongoose.Model<IBlockedIP>) || mongoose.model<IBlockedIP>("BlockedIP", blockedIpSchema);
export default BlockedIP;
