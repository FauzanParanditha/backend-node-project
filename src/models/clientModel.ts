import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface IClient extends Document {
    name: string;
    active: boolean;
    clientId?: string;
    notifyUrl?: string;
    // Origins (scheme+host) allowed to embed this merchant's hosted payment
    // page in an iframe, e.g. ["https://merchant-a.com"]. Used to build a
    // per-order CSP `frame-ancestors` so only the merchant's site can frame it.
    frameOrigins?: string[];
    // When true, the ack response this merchant sends back for callbacks
    // is cryptographically verified using their public key (ClientKey).
    // Default false to preserve backward compatibility for merchants who
    // do not yet sign their ack responses; signature presence is still
    // required either way, only the cryptographic check is gated.
    requireSignedAck?: boolean;
    userIds: Types.ObjectId[];
    adminId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const clientSchema = new mongoose.Schema<IClient>(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            minlength: 1,
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
            // required: true,
        },
        frameOrigins: {
            type: [String],
            default: [],
        },
        requireSignedAck: {
            type: Boolean,
            default: false,
        },
        userIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
        ],
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true,
        },
    },
    {
        timestamps: true,
    },
);

const Client = (mongoose.models.Client as mongoose.Model<IClient>) || mongoose.model<IClient>("Client", clientSchema);
export default Client;
