import mongoose from "mongoose";

const availablePaymentSchema = new mongoose.Schema(
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

const AvailablePayment = mongoose.model("AvailablePayment", availablePaymentSchema);
export default AvailablePayment;
