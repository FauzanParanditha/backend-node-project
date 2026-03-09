import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface IClientAvailablePayment extends Document {
    clientId: string;
    availablePaymentId: Types.ObjectId;
    active: boolean;
    adminId?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const clientAvailablePaymentSchema = new mongoose.Schema<IClientAvailablePayment>(
    {
        clientId: {
            type: String,
            required: true,
        },
        availablePaymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AvailablePayment",
            required: true,
        },
        active: {
            type: Boolean,
            default: true,
        },
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
        },
    },
    {
        timestamps: true,
    },
);

clientAvailablePaymentSchema.index({ clientId: 1, availablePaymentId: 1 }, { unique: true });

const ClientAvailablePayment = mongoose.model<IClientAvailablePayment>(
    "ClientAvailablePayment",
    clientAvailablePaymentSchema,
);
export default ClientAvailablePayment;
