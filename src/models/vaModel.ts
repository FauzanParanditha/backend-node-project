import type { Document } from "mongoose";
import mongoose from "mongoose";

export interface IVaStatic {
    requestId: string;
    errCode: string;
    errCodeDes?: string;
    merchantId: string;
    storeId?: string;
    paymentType: string;
    createTime?: string;
    vaCode?: string;
    expiredTime?: string;
}

export interface IVirtualAccount extends Document {
    payer: string;
    clientId: string;
    vaStatic?: IVaStatic;
    vaCode?: string;
    phoneNumber: string;
    createdAt: Date;
    updatedAt: Date;
}

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

const vaSchema = new mongoose.Schema<IVirtualAccount>(
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

const VirtualAccount = mongoose.model<IVirtualAccount>("VirtualAccount", vaSchema);
export default VirtualAccount;
