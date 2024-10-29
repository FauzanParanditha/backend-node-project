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
    merchantId: { type: String, required: true },
    requestId: { type: String, required: true },
    errCode: { type: String, required: true },
    paymentType: { type: String, required: true },
    amount: { type: Number, required: true },
    createTime: { type: Date, required: true },
    successTime: { type: Date },
    merchantTradeNo: { type: String, required: true },
    platformTradeNo: { type: String, required: true },
    status: { type: String, required: true },
    vaCode: { type: String, required: true },
    transFeeRate: { type: Number, required: true },
    transFeeAmount: { type: Number, required: true },
    totalTransFee: { type: Number, required: true },
    vatFee: { type: Number, required: true },
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
