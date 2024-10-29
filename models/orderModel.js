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
      required: true,
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
      required: true,
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
      select: false,
    },
    paymentId: {
      type: String,
      select: false,
    },
    paymentXendit: paymentXenditSchema,
    paymentPaylabs: paymentPaylabsSchema,
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
