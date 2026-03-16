import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface IProduct extends Document {
    title: string;
    price: number;
    discount: number;
    stock: number;
    category: Types.ObjectId;
    colors: Array<{ color: string }>;
    sizes: Array<{ size: string }>;
    image?: string;
    description: string;
    reviews: Types.ObjectId[];
    adminId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const productSchema = new mongoose.Schema<IProduct>(
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
    },
);

const Product = mongoose.model<IProduct>("Product", productSchema);
export default Product;
