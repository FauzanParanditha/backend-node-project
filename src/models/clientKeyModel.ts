import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface IClientKey extends Document {
    clientId: string;
    publicKey: string;
    active: boolean;
    adminId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ClientKeySchema = new mongoose.Schema<IClientKey>(
    {
        clientId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        publicKey: {
            type: String,
            required: true,
            select: false, // hide publicKey in query result
        },
        active: {
            type: Boolean,
            default: true,
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

export const ClientKeyModel = mongoose.model<IClientKey>("ClientKey", ClientKeySchema);
