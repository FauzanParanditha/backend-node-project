import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      unique: [true, "Email must be unique!"],
      minLength: [1, "Email must have 1 characters!"],
    },
    fullName: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minLength: [1],
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
    verificationCode: {
      type: String,
      select: false,
    },
    verificationCodeValidation: {
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
  },
  {
    timestamps: true, // createdAt, upadtedAt
  }
);

const User = mongoose.model("User", userSchema);
export default User;
