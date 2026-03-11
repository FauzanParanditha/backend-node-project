import type { Document } from "mongoose";
import mongoose from "mongoose";

export interface IAdmin extends Document {
    email: string;
    fullName: string;
    password: string;
    role: "admin" | "finance";
    verified: boolean;
    verifiedAt?: Date;
    verificationCode?: string;
    verificationCodeValidation?: number;
    verificationCodeAttempts?: number;
    verificationCodeLockedUntil?: number;
    forgotPasswordCode?: string;
    forgotPasswordCodeValidation?: number;
    forgotPasswordCodeAttempts?: number;
    forgotPasswordCodeLockedUntil?: number;
    createdAt: Date;
    updatedAt: Date;
}

const adminSchema = new mongoose.Schema<IAdmin>(
    {
        email: {
            type: String,
            required: [true, "Email is required"],
            trim: true,
            unique: true,
            minlength: [1, "Email must have 1 characters!"],
        },
        fullName: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            minlength: 1,
        },
        password: {
            type: String,
            required: [true, "Password must be provided!"],
            trim: true,
            select: false,
        },
        role: {
            type: String,
            enum: ["admin", "finance"],
            default: "admin",
        },
        verified: {
            type: Boolean,
            default: false,
        },
        verifiedAt: {
            type: Date,
        },
        verificationCode: {
            type: String,
            select: false,
        },
        verificationCodeValidation: {
            type: Number,
            select: false,
        },
        verificationCodeAttempts: {
            type: Number,
            default: 0,
            select: false,
        },
        verificationCodeLockedUntil: {
            type: Number,
            select: false,
        },
        forgotPasswordCode: {
            type: String,
            select: false,
        },
        forgotPasswordCodeValidation: {
            type: Number,
            select: false,
        },
        forgotPasswordCodeAttempts: {
            type: Number,
            default: 0,
            select: false,
        },
        forgotPasswordCodeLockedUntil: {
            type: Number,
            select: false,
        },
    },
    {
        timestamps: true,
    },
);

const Admin = mongoose.model<IAdmin>("Admin", adminSchema);
export default Admin;
