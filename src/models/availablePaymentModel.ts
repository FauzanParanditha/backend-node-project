import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface IAvailablePayment extends Document {
    name: string;
    active: boolean;
    image: string;
    category: string;
    adminId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const availablePaymentSchema = new mongoose.Schema<IAvailablePayment>(
    {
        name: {
            type: String,
            required: true,
        },
        active: {
            type: Boolean,
            required: true,
            default: true,
        },
        image: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            required: true,
        },
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

const AvailablePayment = mongoose.model<IAvailablePayment>("AvailablePayment", availablePaymentSchema);
export default AvailablePayment;
