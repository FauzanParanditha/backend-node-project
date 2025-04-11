import mongoose from "mongoose";

const callbackLogSchema = new mongoose.Schema(
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
            enum: ["system", "client"],
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

const CallbackLog = mongoose.model("CallbackLog", callbackLogSchema);
export default CallbackLog;
