import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            minLength: [1],
        },
        active: {
            type: Boolean,
            default: true,
        },
        clientId: {
            type: String,
            // unique: true,
            select: false,
        },
        notifyUrl: {
            type: String,
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true,
        },
    },
    {
        timestamps: true, // createdAt, upadtedAt
    },
);

const Client = mongoose.model("Client", clientSchema);
export default Client;
