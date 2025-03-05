import mongoose from "mongoose";

const failedCallbackSchema = new mongoose.Schema(
    {
        payload: { type: Object, required: true },
        callbackUrl: { type: String, required: true },
        retryCount: { type: Number, default: 0 },
        errDesc: { type: String },
        clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
        nextRetryAt: { type: Date, required: true },
        status: { type: String, enum: ["pending", "completed"], default: "pending" },
    },
    {
        timestamps: true,
    },
);

const FailedCallback = mongoose.model("FailedCallback", failedCallbackSchema);
export default FailedCallback;
