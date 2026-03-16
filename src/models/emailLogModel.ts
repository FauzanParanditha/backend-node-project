import type { Document } from "mongoose";
import mongoose from "mongoose";

export interface IEmailLog extends Document {
    email: string;
    messages?: Record<string, unknown>;
    statusCode?: number;
    createdAt: Date;
    updatedAt: Date;
}

const emailLogSchema = new mongoose.Schema<IEmailLog>(
    {
        email: { type: String, required: true },
        messages: { type: Object },
        statusCode: { type: Number },
    },
    { timestamps: true },
);

const EmailLog = mongoose.model<IEmailLog>("EmailLogs", emailLogSchema);

export default EmailLog;
