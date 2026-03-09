import type { Document } from "mongoose";
import mongoose from "mongoose";

export interface ICounter extends Document {
    _id: string;
    seq: number;
}

const counterSchema = new mongoose.Schema<ICounter>({
    _id: {
        type: String,
        required: true,
    },
    seq: {
        type: Number,
        required: true,
        default: 0,
    },
});

export default mongoose.models.Counter || mongoose.model<ICounter>("Counter", counterSchema);
