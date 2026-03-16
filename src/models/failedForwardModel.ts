import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface IFailedCallback extends Document {
    payload: Record<string, unknown>;
    callbackUrl: string;
    retryCount: number;
    errDesc?: string;
    clientId: Types.ObjectId;
    nextRetryAt: Date;
    status: "pending" | "completed";
    lastTriedAt?: Date;
    lastError?: string;
    createdAt: Date;
    updatedAt: Date;
}

const failedCallbackSchema = new mongoose.Schema<IFailedCallback>(
    {
        payload: { type: Object, required: true },
        callbackUrl: { type: String, required: true },
        retryCount: { type: Number, default: 0 },
        errDesc: { type: String },
        clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
        nextRetryAt: { type: Date, required: true },
        status: { type: String, enum: ["pending", "completed"], default: "pending" },
        lastTriedAt: { type: Date },
        lastError: { type: String },
    },
    {
        timestamps: true,
    },
);

const FailedCallback = mongoose.model<IFailedCallback>("FailedCallback", failedCallbackSchema);
export default FailedCallback;
