import type { Document } from "mongoose";
import mongoose from "mongoose";

export interface IUser extends Document {
    email: string;
    fullName: string;
    password: string;
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

const userSchema = new mongoose.Schema<IUser>(
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

const User = mongoose.model<IUser>("User", userSchema);
export default User;
