import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface ICategory extends Document {
    name: string;
    adminId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const categorySchema = new mongoose.Schema<ICategory>(
    {
        name: {
            type: String,
            required: true,
            unique: true,
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

const Category = mongoose.model<ICategory>("Category", categorySchema);
export default Category;
