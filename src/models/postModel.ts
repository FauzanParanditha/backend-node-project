import type { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface IPost extends Document {
    title: string;
    description: string;
    userId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const postSchema = new mongoose.Schema<IPost>(
    {
        title: {
            type: String,
            required: [true, "Title is required!"],
            trim: true,
        },
        description: {
            type: String,
            required: [true, "description is required!"],
            trim: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    },
);

const Post = mongoose.model<IPost>("Post", postSchema);
export default Post;
