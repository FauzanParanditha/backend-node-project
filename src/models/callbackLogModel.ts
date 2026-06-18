import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface ICallbackLog extends Document {
    type: "incoming" | "outgoing";
    source: "paylabs" | "system";
    target: "system" | "client" | "internal";
    status: "success" | "failed" | "error";
    clientId?: Types.ObjectId;
    payload: Record<string, unknown>;
    response?: Record<string, unknown>;
    statusCode?: number;
    requestHeaders?: Record<string, unknown>;
    responseHeaders?: Record<string, unknown>;
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
        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            index: true,
        },
        payload: {
            type: Object,
            required: true,
        },
        response: {
            type: Object,
        },
        statusCode: {
            type: Number,
        },
        requestHeaders: {
            type: Object,
        },
        responseHeaders: {
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

const CallbackLog = (mongoose.models.CallbackLog as mongoose.Model<ICallbackLog>) || mongoose.model<ICallbackLog>("CallbackLog", callbackLogSchema);
export default CallbackLog;
