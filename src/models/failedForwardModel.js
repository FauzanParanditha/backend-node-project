import mongoose from "mongoose";

const failedCallback = new mongoose.Schema(
    {
        payload: { type: Object },
        callbackUrl: { type: String },
        retryCount: { type: Number, default: 0 },
        errDesc: { type: String },
    },
    {
        timestamps: true,
    },
);

const FailedCallback = mongoose.model("FailedCallback", failedCallback);
export default FailedCallback;
