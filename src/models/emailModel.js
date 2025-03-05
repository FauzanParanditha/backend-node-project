import mongoose from "mongoose";

const EmailSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, "Email is required"],
            trim: true,
            minLength: [1, "Email must have 1 characters!"],
        },
        messages: {
            type: Object,
            trim: true,
            minLength: [1],
        },
        statusCode: {
            type: String,
            required: [true, "Status must be provided!"],
            trim: true,
            select: false,
        },
    },
    {
        timestamps: true, // createdAt, upadtedAt
    },
);

const Email = mongoose.model("EmailLog", EmailSchema);
export default Email;
