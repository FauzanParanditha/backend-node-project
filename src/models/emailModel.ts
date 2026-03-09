import type { Document } from "mongoose";
import mongoose from "mongoose";

export interface IEmail extends Document {
    email: string;
    messages?: Record<string, unknown>;
    statusCode: string;
    createdAt: Date;
    updatedAt: Date;
}

const EmailSchema = new mongoose.Schema<IEmail>(
    {
        email: {
            type: String,
            required: [true, "Email is required"],
            trim: true,
            minlength: [1, "Email must have 1 characters!"],
        },
        messages: {
            type: Object,
            trim: true,
            minlength: [1],
        },
        statusCode: {
            type: String,
            required: [true, "Status must be provided!"],
            trim: true,
            select: false,
        },
    },
    {
        timestamps: true,
    },
);

const Email = mongoose.model<IEmail>("EmailLog", EmailSchema);
export default Email;
