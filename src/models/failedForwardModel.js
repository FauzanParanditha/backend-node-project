import mongoose from "mongoose";

const failedCallback = new mongoose.Schema(
    {
        payload: { type: Object },
        callbackUrl: { type: String },
        retryCount: { type: Number, default: 0 },
        errDesc: { type: String },
        clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    },
    {
        timestamps: true,
    },
);

const FailedCallback = mongoose.model("FailedCallback", failedCallback);
export default FailedCallback;
