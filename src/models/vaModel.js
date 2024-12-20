import mongoose from "mongoose";

const generateVaStaticSchema = new mongoose.Schema({
    requestId: { type: String, required: true },
    errCode: { type: String, required: true },
    errCodeDes: { type: String },
    merchantId: { type: String, required: true },
    storeId: { type: String },
    paymentType: { type: String, required: true },
    createTime: { type: String },
    vaCode: { type: String },
    expiredTime: { type: String },
});

const vaSchema = new mongoose.Schema(
    {
        payer: {
            type: String,
            required: true,
        },
        clientId: {
            type: String,
            required: true,
        },
        vaStatic: generateVaStaticSchema,
        vaCode: { type: String },
        phoneNumber: {
            type: String,
            required: true,
        },
    },
    { timestamps: true },
);

const VirtualAccount = mongoose.model("VirtualAccount", vaSchema);
export default VirtualAccount;
