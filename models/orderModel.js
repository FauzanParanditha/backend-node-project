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
  {
    timestamps: true,
  }
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
        title: {
          type: String,
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
      enum: ["pending", "paid", "failed", "expired"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    paymentLink: {
      type: String,
    },
    paymentId: {
      type: String,
    },
    storeId: {
      type: String,
    },
    paymentXendit: paymentXenditSchema,
    paymentPaylabs: paymentPaylabsSchema,
    qris: qrisSchema,
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
