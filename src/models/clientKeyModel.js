import mongoose from "mongoose";

const ClientKeySchema = new mongoose.Schema(
    {
        clientId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        publicKey: {
            type: String,
            required: true,
            select: false, // hide publicKey in query result
        },
        active: {
            type: Boolean,
            default: true,
        },
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true,
        },
    },
    {
        timestamps: true, // otomatis bikin createdAt dan updatedAt
    },
);

export const ClientKeyModel = mongoose.model("ClientKey", ClientKeySchema);
