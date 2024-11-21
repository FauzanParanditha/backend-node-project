import mongoose from "mongoose";

const paymentXenditSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    created: {
      type: Date,
      required: true,
    },
    isHigh: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    currency: {
      type: String,
      required: true,
    },
    bankCode: {
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    externalId: {
      type: String,
      required: true,
    },
    paidAmount: {
      type: Number,
      required: true,
    },
    payerEmail: {
      type: String,
      required: true,
    },
    merchantName: {
      type: String,
      required: true,
    },
    paymentChannel: {
      type: String,
      required: true,
    },
    paymentDestination: {
      type: String,
    },
    failureRedirectUrl: {
      type: String,
      required: true,
    },
    successRedirectUrl: {
      type: String,
      required: true,
    },
  },
  { _id: false }
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
  { _id: false }
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
  { _id: false }
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
  { _id: false }
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
  { _id: false }
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
  { _id: false }
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
  { _id: false }
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
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        discount: {
          required: true,
          type: Number,
        },
        colors: [
          {
            color: { type: String, required: true },
            _id: false,
          },
        ],
        sizes: [
          {
            size: { type: String, required: true },
            _id: false,
          },
        ],
        _id: false,
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "expired", "cancel"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    paymentType: {
      type: String,
      required: true,
    },
    paymentLink: {
      type: String,
    },
    paymentExpired: {
      type: String,
    },
    paymentActions: {
      type: Object,
    },
    paymentId: {
      type: String,
    },
    paymentCode: {
      type: String,
    },
    partnerServiceId: {
      type: String,
    },
    customerNo: {
      type: String,
    },
    virtualAccountNo: {
      type: String,
    },
    storeId: {
      type: String,
    },
    paymentXendit: paymentXenditSchema,
    paymentPaylabs: paymentPaylabsSchema,
    paymentPaylabsVaSnap: paymentPaylabsVaSnap,
    qris: qrisSchema,
    vaSnap: generateVaSnapSchema,
    va: generateVaSchema,
    cc: ccSchema,
    eMoney: eMoneySchema,
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
