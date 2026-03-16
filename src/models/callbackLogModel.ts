import type { Document } from "mongoose";
import mongoose from "mongoose";

export interface ICallbackLog extends Document {
    type: "incoming" | "outgoing";
    source: "paylabs" | "system";
    target: "system" | "client" | "internal";
    status: "success" | "failed" | "error";
    payload: Record<string, unknown>;
    response?: Record<string, unknown>;
    errorMessage?: string;
    requestId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const callbackLogSchema = new mongoose.Schema<ICallbackLog>(
    {
        type: {
            type: String,
            enum: ["incoming", "outgoing"],
            required: true,
        },
        source: {
            type: String,
            enum: ["paylabs", "system"],
            required: true,
        },
        target: {
            type: String,
            enum: ["system", "client", "internal"],
            required: true,
        },
        status: {
            type: String,
            enum: ["success", "failed", "error"],
            required: true,
        },
        payload: {
            type: Object,
            required: true,
        },
        response: {
            type: Object,
        },
        errorMessage: {
            type: String,
        },
        requestId: {
            type: String,
        },
    },
    {
        timestamps: true,
    },
);

const CallbackLog = mongoose.model<ICallbackLog>("CallbackLog", callbackLogSchema);
export default CallbackLog;
