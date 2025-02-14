import mongoose from "mongoose";

const apiLogSchema = new mongoose.Schema(
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

const ApiLog = mongoose.model("ApiLog", apiLogSchema);

export default ApiLog;
