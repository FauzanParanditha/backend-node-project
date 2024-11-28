import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: {
      required: true,
      type: String,
    },
    price: {
      required: true,
      type: Number,
    },
    discount: {
      required: true,
      type: Number,
    },
    stock: {
      required: true,
      type: Number,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
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
    image: {
      // required: true,
      type: String,
    },
    description: {
      required: true,
      type: String,
    },
    reviews: [{ type: mongoose.Types.ObjectId, ref: "Review" }],
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);
export default Product;
