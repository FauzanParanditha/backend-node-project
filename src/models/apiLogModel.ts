import type { Document } from "mongoose";
import mongoose from "mongoose";

export interface IApiLog extends Document {
    method: string;
    endpoint: string;
    headers: Record<string, unknown>;
    body?: Record<string, unknown>;
    statusCode?: unknown;
    response?: Record<string, unknown>;
    ipAddress: string;
    createdAt: Date;
    updatedAt: Date;
}

const apiLogSchema = new mongoose.Schema<IApiLog>(
    {
        method: { type: String, required: true },
        endpoint: { type: String, required: true },
        headers: { type: Object, required: true },
        body: { type: Object },
        statusCode: { type: mongoose.Schema.Types.Mixed },
        response: { type: Object },
        ipAddress: { type: String, required: true },
    },
    { timestamps: true },
);

apiLogSchema.index({ endpoint: "text" });
apiLogSchema.index({ createdAt: -1 });
apiLogSchema.index({ endpoint: 1, createdAt: -1 });
apiLogSchema.index({ endpoint: 1 }, { collation: { locale: "en", strength: 2 } });

const ApiLog = mongoose.model<IApiLog>("ApiLog", apiLogSchema);

export default ApiLog;
