import mongoose from "mongoose";

const clientAvailablePaymentSchema = new mongoose.Schema(
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

const ClientAvailablePayment = mongoose.model("ClientAvailablePayment", clientAvailablePaymentSchema);
export default ClientAvailablePayment;
