import mongoose from "mongoose";

const emailLogSchema = new mongoose.Schema(
    {
        email: { type: String, required: true },
        messages: { type: Object },
        statusCode: { type: Number },
    },
    { timestamps: true },
);

const EmailLog = mongoose.model("EmailLogs", emailLogSchema);

export default EmailLog;
