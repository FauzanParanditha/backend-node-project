import type { Document } from "mongoose";
import mongoose from "mongoose";
import { convertToDate } from "../service/paylabs.js";

// ─── Sub-document interfaces ───

export interface IProductInfo {
    id: string;
    name: string;
    price: number;
    type: string;
    url?: string;
    quantity: number;
}

export interface IPaymentXendit {
    paymentId: string;
    status: string;
    created: Date;
    isHigh: boolean;
    paidAt?: Date;
    currency: string;
    bankCode?: string;
    description: string;
    externalId: string;
    paidAmount: number;
    payerEmail: string;
    merchantName: string;
    paymentChannel: string;
    paymentDestination?: string;
    failureRedirectUrl: string;
    successRedirectUrl: string;
}

export interface IPaymentPaylabs {
    requestId: string;
    errCode: string;
    errCodeDes?: string;
    merchantId: string;
    storeId?: string;
    paymentType: string;
    amount: number;
    merchantTradeNo: string;
    platformTradeNo?: string;
    createTime?: Date;
    successTime?: Date;
    status?: string;
    productName?: string;
    paymentMethodInfo?: Record<string, unknown>;
    vaCode?: string;
    transFeeRate?: number;
    transFeeAmount?: number;
    totalTransFee?: number;
    vatFee?: number;
}

export interface IQris {
    requestId: string;
    errCode: string;
    errCodeDes?: string;
    merchantId: string;
    storeId?: string;
    paymentType: string;
    requestAmount?: number;
    amount: number;
    merchantTradeNo: string;
    createTime?: string;
    qrCode?: string;
    qrisUrl?: string;
    nmid?: string;
    platformTradeNo?: string;
    successTime?: string;
    expiredTime?: string;
    status?: string;
    productName: string;
    rrn?: string;
    tid?: string;
    payer?: string;
    phoneNumber?: string;
    issuerId?: string;
    productInfo?: IProductInfo[];
    transFeeRate?: string;
    transFeeAmount?: string;
    totalTransFee?: string;
    vatFee?: string;
}

export interface IGenerateVa {
    requestId: string;
    errCode: string;
    errCodeDes?: string;
    merchantId: string;
    storeId?: string;
    paymentType: string;
    requestAmount?: number;
    amount?: number;
    merchantTradeNo?: string;
    createTime?: string;
    vaCode?: string;
    platformTradeNo?: string;
    successTime?: string;
    expiredTime?: string;
    status?: string;
    productName?: string;
    productInfo?: IProductInfo[];
    transFeeRate?: string;
    transFeeAmount?: string;
    totalTransFee?: string;
    vatFee?: string;
}

export interface IAmountCurrency {
    value: string;
    currency: string;
}

export interface IBillDescription {
    english?: string;
    indonesia?: string;
}

export interface IBillDetail {
    billCode?: string;
    billNo?: string;
    billName?: string;
    billShortName?: string;
    billDescription?: IBillDescription;
    billSubCompany?: string;
    billAmount: IAmountCurrency;
    additionalInfo?: Record<string, unknown>;
}

export interface IFreeText {
    english?: string;
    indonesia?: string;
}

export interface IVaSnapData {
    partnerServiceId: string;
    customerNo: string;
    virtualAccountNo: string;
    virtualAccountName?: string;
    virtualAccountEmail?: string;
    virtualAccountPhone?: string;
    trxId?: string;
    totalAmount: IAmountCurrency;
    billDetails?: IBillDetail[];
    freeTexts?: IFreeText[];
    virtualAccountTrxType?: string;
    feeAmount?: IAmountCurrency;
    expiredDate?: string;
    additionalInfo?: Record<string, unknown>;
}

export interface IGenerateVaSnap {
    responseCode: string;
    responseMessage: string;
    virtualAccountData: IVaSnapData;
}

export interface IDeleteVaSnapData {
    partnerServiceId: string;
    customerNo: string;
    virtualAccountNo: string;
    trxId?: string;
    additionalInfo?: Record<string, unknown>;
}

export interface IGenerateDeleteVaSnap {
    responseCode: string;
    responseMessage: string;
    virtualAccountData: IDeleteVaSnapData;
}

export interface IPaymentPaylabsVaSnapAdditionalInfo {
    transFeeRate?: number;
    transFeeAmount?: number;
    totalTransFee?: number;
    vatFee?: number;
    paymentType?: string;
}

export interface IPaymentPaylabsVaSnap {
    partnerServiceId: string;
    customerNo: string;
    virtualAccountNo: string;
    virtualAccountName?: string;
    virtualAccountEmail?: string;
    virtualAccountPhone?: string;
    trxId: string;
    paymentRequestId: string;
    channelCode?: string;
    hashedSourceAccountNo?: string;
    sourceBankCode?: string;
    paidAmount: IAmountCurrency;
    cumulativePaymentAmount?: IAmountCurrency;
    paidBills?: string;
    totalAmount?: IAmountCurrency;
    trxDateTime?: Date;
    referenceNo?: string;
    journalNum?: string;
    paymentType?: string;
    flagAdvise?: string;
    subCompany?: string;
    billDetails?: IBillDetail[];
    freeTexts?: IFreeText[];
    additionalInfo?: IPaymentPaylabsVaSnapAdditionalInfo;
}

export interface ICc {
    requestId: string;
    errCode: string;
    errCodeDes?: string;
    merchantId: string;
    storeId?: string;
    paymentType: string;
    requestAmount?: number;
    amount: number;
    merchantTradeNo: string;
    createTime?: string;
    paymentActions?: { payUrl?: string };
    platformTradeNo?: string;
    successTime?: string;
    expiredTime?: string;
    status?: string;
    productName: string;
    productInfo?: IProductInfo[];
    transFeeRate?: string;
    transFeeAmount?: string;
    totalTransFee?: string;
    vatFee?: string;
}

export interface IEMoney {
    requestId: string;
    errCode: string;
    errCodeDes?: string;
    merchantId: string;
    storeId?: string;
    paymentType: string;
    requestAmount?: number;
    amount: number;
    merchantTradeNo: string;
    createTime?: string;
    paymentActions?: {
        payUrl?: string;
        mobilePayUrl?: string;
        appDeeplink?: string;
        pushPay?: string;
    };
    platformTradeNo?: string;
    successTime?: string;
    expiredTime?: string;
    status?: string;
    productName: string;
    productInfo?: IProductInfo[];
    transFeeRate?: string;
    transFeeAmount?: string;
    totalTransFee?: string;
    vatFee?: string;
}

export interface IOrderItem {
    id: string;
    price: number;
    quantity: number;
    name: string;
    type: string;
    domain?: string;
}

export interface IOrder extends Document {
    orderId: string;
    clientId: string;
    items: IOrderItem[];
    totalAmount: number;
    payer: string;
    phoneNumber: string;
    paymentStatus: "pending" | "paid" | "failed" | "expired" | "cancel";
    paymentMethod: string;
    paymentType: string;
    paymentLink?: string;
    paymentExpired?: string;
    paymentExpiredAt?: Date;
    paymentActions?: Record<string, unknown>;
    paymentId?: string;
    paymentCode?: string;
    partnerServiceId?: string;
    customerNo?: string;
    virtualAccountNo?: string;
    storeId?: string;
    paymentXendit?: IPaymentXendit;
    paymentPaylabs?: IPaymentPaylabs;
    paymentPaylabsVaSnap?: IPaymentPaylabsVaSnap;
    qris?: IQris;
    vaSnap?: IGenerateVaSnap;
    vaSnapDelete?: IGenerateDeleteVaSnap;
    va?: IGenerateVa;
    cc?: ICc;
    eMoney?: IEMoney;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Sub-schemas ───

const paymentXenditSchema = new mongoose.Schema(
    {
        paymentId: { type: String, required: true },
        status: { type: String, required: true },
        created: { type: Date, required: true },
        isHigh: { type: Boolean, default: false },
        paidAt: { type: Date },
        currency: { type: String, required: true },
        bankCode: { type: String },
        description: { type: String, required: true },
        externalId: { type: String, required: true },
        paidAmount: { type: Number, required: true },
        payerEmail: { type: String, required: true },
        merchantName: { type: String, required: true },
        paymentChannel: { type: String, required: true },
        paymentDestination: { type: String },
        failureRedirectUrl: { type: String, required: true },
        successRedirectUrl: { type: String, required: true },
    },
    { _id: false },
);

const paymentPaylabsSchema = new mongoose.Schema(
    {
        requestId: { type: String, required: true },
        errCode: { type: String, required: true },
        errCodeDes: { type: String },
        merchantId: { type: String, required: true },
        storeId: { type: String },
        paymentType: { type: String, required: true },
        amount: { type: Number, required: true },
        merchantTradeNo: { type: String, required: true },
        platformTradeNo: { type: String },
        createTime: { type: Date },
        successTime: { type: Date },
        status: { type: String },
        productName: { type: String },
        paymentMethodInfo: { type: Object },
        vaCode: { type: String },
        transFeeRate: { type: Number },
        transFeeAmount: { type: Number },
        totalTransFee: { type: Number },
        vatFee: { type: Number },
    },
    { _id: false },
);

const productInfoSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    type: { type: String, required: true },
    url: { type: String },
    quantity: { type: Number, required: true },
});

const qrisSchema = new mongoose.Schema(
    {
        requestId: { type: String, required: true },
        errCode: { type: String, required: true },
        errCodeDes: { type: String },
        merchantId: { type: String, required: true },
        storeId: { type: String },
        paymentType: { type: String, required: true },
        requestAmount: { type: Number },
        amount: { type: Number, required: true },
        merchantTradeNo: { type: String, required: true },
        createTime: { type: String },
        qrCode: { type: String },
        qrisUrl: { type: String },
        nmid: { type: String },
        platformTradeNo: { type: String },
        successTime: { type: String },
        expiredTime: { type: String },
        status: { type: String },
        productName: { type: String, required: true },
        rrn: { type: String },
        tid: { type: String },
        payer: { type: String },
        phoneNumber: { type: String },
        issuerId: { type: String },
        productInfo: [productInfoSchema],
        transFeeRate: { type: String },
        transFeeAmount: { type: String },
        totalTransFee: { type: String },
        vatFee: { type: String },
    },
    { _id: false },
);

const generateVaSchema = new mongoose.Schema(
    {
        requestId: { type: String, required: true },
        errCode: { type: String, required: true },
        errCodeDes: { type: String },
        merchantId: { type: String, required: true },
        storeId: { type: String },
        paymentType: { type: String, required: true },
        requestAmount: { type: Number },
        amount: { type: Number },
        merchantTradeNo: { type: String },
        createTime: { type: String },
        vaCode: { type: String },
        platformTradeNo: { type: String },
        successTime: { type: String },
        expiredTime: { type: String },
        status: { type: String },
        productName: { type: String },
        productInfo: [productInfoSchema],
        transFeeRate: { type: String },
        transFeeAmount: { type: String },
        totalTransFee: { type: String },
        vatFee: { type: String },
    },
    { _id: false },
);

const generateVaSnapSchema = new mongoose.Schema(
    {
        responseCode: { type: String, required: true },
        responseMessage: { type: String, required: true },
        virtualAccountData: {
            partnerServiceId: { type: String, required: true },
            customerNo: { type: String, required: true },
            virtualAccountNo: { type: String, required: true },
            virtualAccountName: { type: String },
            virtualAccountEmail: { type: String },
            virtualAccountPhone: { type: String },
            trxId: { type: String },
            totalAmount: {
                value: { type: String, required: true },
                currency: { type: String, required: true },
            },
            billDetails: [
                {
                    billCode: { type: String },
                    billNo: { type: String },
                    billName: { type: String },
                    billShortName: { type: String },
                    billDescription: {
                        english: { type: String },
                        indonesia: { type: String },
                    },
                    billSubCompany: { type: String },
                    billAmount: {
                        value: { type: String, required: true },
                        currency: { type: String, required: true },
                    },
                    additionalInfo: {},
                },
            ],
            freeTexts: [
                {
                    english: { type: String },
                    indonesia: { type: String },
                },
            ],
            virtualAccountTrxType: { type: String },
            feeAmount: {
                value: { type: String },
                currency: { type: String },
            },
            expiredDate: { type: String },
            additionalInfo: {},
        },
    },
    { _id: false },
);

const generateDeleteVaSnapSchema = new mongoose.Schema(
    {
        responseCode: { type: String, required: true },
        responseMessage: { type: String, required: true },
        virtualAccountData: {
            partnerServiceId: { type: String, required: true },
            customerNo: { type: String, required: true },
            virtualAccountNo: { type: String, required: true },
            trxId: { type: String },
            additionalInfo: {},
        },
    },
    { _id: false },
);

const paymentPaylabsVaSnap = new mongoose.Schema(
    {
        partnerServiceId: { type: String, maxlength: 8, required: true },
        customerNo: { type: String, maxlength: 20, required: true },
        virtualAccountNo: { type: String, maxlength: 28, required: true },
        virtualAccountName: { type: String, maxlength: 255 },
        virtualAccountEmail: { type: String, maxlength: 255 },
        virtualAccountPhone: { type: String, maxlength: 30 },
        trxId: { type: String, maxlength: 64, required: true },
        paymentRequestId: { type: String, maxlength: 128, required: true },
        channelCode: { type: String, maxlength: 4 },
        hashedSourceAccountNo: { type: String, maxlength: 32 },
        sourceBankCode: { type: String, maxlength: 3 },
        paidAmount: {
            value: { type: String, maxlength: 16, required: true },
            currency: { type: String, maxlength: 3, required: true },
        },
        cumulativePaymentAmount: {
            value: { type: String, maxlength: 16 },
            currency: { type: String, maxlength: 3 },
        },
        paidBills: { type: String, maxlength: 6 },
        totalAmount: {
            value: { type: String, maxlength: 16 },
            currency: { type: String, maxlength: 3 },
        },
        trxDateTime: { type: Date },
        referenceNo: { type: String, maxlength: 64 },
        journalNum: { type: String, maxlength: 6 },
        paymentType: { type: String, maxlength: 1 },
        flagAdvise: { type: String, maxlength: 1 },
        subCompany: { type: String, maxlength: 5 },
        billDetails: [
            {
                billCode: { type: String, maxlength: 2 },
                billNo: { type: String, maxlength: 18 },
                billName: { type: String, maxlength: 20 },
                billShortName: { type: String, maxlength: 20 },
                billDescription: {
                    english: { type: String, maxlength: 18 },
                    indonesia: { type: String, maxlength: 18 },
                },
                billSubCompany: { type: String, maxlength: 5 },
                billAmount: {
                    value: { type: String, maxlength: 16, required: true },
                    currency: { type: String, maxlength: 3, required: true },
                },
                additionalInfo: { type: Object },
            },
        ],
        freeTexts: [
            {
                english: { type: String, maxlength: 18 },
                indonesia: { type: String, maxlength: 18 },
            },
        ],
        additionalInfo: {
            transFeeRate: { type: Number, max: 999999, precision: 6 },
            transFeeAmount: { type: Number, max: 999999999999, precision: 2 },
            totalTransFee: { type: Number, max: 999999, precision: 6 },
            vatFee: { type: Number, max: 999999, precision: 6 },
            paymentType: { type: String, max: 20 },
        },
    },
    { _id: false },
);

const ccSchema = new mongoose.Schema(
    {
        requestId: { type: String, required: true },
        errCode: { type: String, required: true },
        errCodeDes: { type: String },
        merchantId: { type: String, required: true },
        storeId: { type: String },
        paymentType: { type: String, required: true },
        requestAmount: { type: Number },
        amount: { type: Number, required: true },
        merchantTradeNo: { type: String, required: true },
        createTime: { type: String },
        paymentActions: {
            payUrl: { type: String },
        },
        platformTradeNo: { type: String },
        successTime: { type: String },
        expiredTime: { type: String },
        status: { type: String },
        productName: { type: String, required: true },
        productInfo: [productInfoSchema],
        transFeeRate: { type: String },
        transFeeAmount: { type: String },
        totalTransFee: { type: String },
        vatFee: { type: String },
    },
    { _id: false },
);

const eMoneySchema = new mongoose.Schema(
    {
        requestId: { type: String, required: true },
        errCode: { type: String, required: true },
        errCodeDes: { type: String },
        merchantId: { type: String, required: true },
        storeId: { type: String },
        paymentType: { type: String, required: true },
        requestAmount: { type: Number },
        amount: { type: Number, required: true },
        merchantTradeNo: { type: String, required: true },
        createTime: { type: String },
        paymentActions: {
            payUrl: { type: String },
            mobilePayUrl: { type: String },
            appDeeplink: { type: String },
            pushPay: { type: String },
        },
        platformTradeNo: { type: String },
        successTime: { type: String },
        expiredTime: { type: String },
        status: { type: String },
        productName: { type: String, required: true },
        productInfo: [productInfoSchema],
        transFeeRate: { type: String },
        transFeeAmount: { type: String },
        totalTransFee: { type: String },
        vatFee: { type: String },
    },
    { _id: false },
);

// ─── Main Order schema ───

const orderSchema = new mongoose.Schema<IOrder>(
    {
        orderId: {
            type: String,
            required: true,
            unique: true,
        },
        clientId: {
            type: String,
            ref: "Client",
            required: true,
        },
        items: [
            {
                id: { type: String, required: true },
                price: { type: Number, required: true },
                quantity: { type: Number, required: true },
                name: { type: String, required: true },
                type: { type: String, required: true },
                domain: { type: String },
                _id: false,
            },
        ],
        totalAmount: { type: Number, required: true },
        payer: { type: String, required: true },
        phoneNumber: { type: String, required: true },
        paymentStatus: {
            type: String,
            enum: ["pending", "paid", "failed", "expired", "cancel"],
            default: "pending",
        },
        paymentMethod: { type: String, required: true },
        paymentType: { type: String, required: true },
        paymentLink: { type: String },
        paymentExpired: { type: String },
        paymentExpiredAt: { type: Date },
        paymentActions: { type: Object },
        paymentId: { type: String },
        paymentCode: { type: String },
        partnerServiceId: { type: String },
        customerNo: { type: String },
        virtualAccountNo: { type: String },
        storeId: { type: String },
        paymentXendit: paymentXenditSchema,
        paymentPaylabs: paymentPaylabsSchema,
        paymentPaylabsVaSnap: paymentPaylabsVaSnap,
        qris: qrisSchema,
        vaSnap: generateVaSnapSchema,
        vaSnapDelete: generateDeleteVaSnapSchema,
        va: generateVaSchema,
        cc: ccSchema,
        eMoney: eMoneySchema,
    },
    { timestamps: true },
);

orderSchema.index({ paymentStatus: 1, paymentExpiredAt: 1 });
orderSchema.index({ clientId: 1, paymentStatus: 1 });
orderSchema.index({ paymentStatus: 1, updatedAt: -1 });
orderSchema.index({ clientId: 1 });

orderSchema.pre("save", function (next) {
    if (this.isModified("paymentExpired")) {
        this.paymentExpiredAt = this.paymentExpired ? (convertToDate(this.paymentExpired) ?? undefined) : undefined;
    }
    next();
});

const Order = mongoose.model<IOrder>("Order", orderSchema);
export default Order;
