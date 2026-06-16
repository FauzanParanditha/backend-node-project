import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export type FailedCallbackStatus = "pending" | "processing" | "failed" | "dead" | "completed";

export interface IFailedCallback extends Document {
    payload: Record<string, unknown>;
    callbackUrl: string;
    retryCount: number;
    errDesc?: string;
    clientId: Types.ObjectId;
    nextRetryAt: Date;
    status: FailedCallbackStatus;
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
        // Enum aligned with the values the retry/forward code actually writes:
        // pending (initial / scheduled), processing (admin retry running),
        // failed (one attempt finished but more retries remain),
        // dead (retryCount >= MAX_RETRY, requires force-retry to revive),
        // completed (success, document is normally deleted instead).
        status: {
            type: String,
            enum: ["pending", "processing", "failed", "dead", "completed"],
            default: "pending",
        },
        lastTriedAt: { type: Date },
        lastError: { type: String },
    },
    {
        timestamps: true,
    },
);

// Partial TTL index: auto-delete documents with status "dead" 30 days after
// their last update. Other statuses (pending/processing/failed/completed) are
// untouched so the cleanup never racks an in-flight retry. The cron job in
// src/cron/cron.ts is responsible for surfacing stuck "processing" records
// before this index ever sees them.
failedCallbackSchema.index(
    { updatedAt: 1 },
    {
        expireAfterSeconds: 30 * 24 * 60 * 60,
        partialFilterExpression: { status: "dead" },
        name: "dead_callback_ttl",
    },
);

const FailedCallback = mongoose.model<IFailedCallback>("FailedCallback", failedCallbackSchema);
export default FailedCallback;
