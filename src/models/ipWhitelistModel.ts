import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface IIPWhitelist extends Document {
    ipAddress: string;
    adminId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ipWhitelistSchema = new mongoose.Schema<IIPWhitelist>(
    {
        ipAddress: {
            type: String,
            required: true,
            unique: true,
        },
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true,
        },
    },
    {
        timestamps: true,
    },
);

const IPWhitelist = mongoose.model<IIPWhitelist>("IPWhitelist", ipWhitelistSchema);
export default IPWhitelist;
