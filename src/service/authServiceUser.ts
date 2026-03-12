import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ResponseError } from "../error/responseError.js";
import User from "../models/userModel.js";
import { compareDoHash, doHash, hmacProcess } from "../utils/helper.js";
import { generateForgotPasswordLink, sendForgotPasswordEmail, sendVerifiedEmail } from "./sendMail.js";

const VERIFICATION_CODE_TTL_MS = 5 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;
const VERIFICATION_LOCK_MS = 15 * 60 * 1000;
const FORGOT_PASSWORD_TTL_MS = 5 * 60 * 1000;
const MAX_FORGOT_PASSWORD_ATTEMPTS = 5;
const FORGOT_PASSWORD_LOCK_MS = 15 * 60 * 1000;

const generateVerificationCode = (): string => crypto.randomInt(100000, 1000000).toString();

const getVerificationLockMessage = (lockedUntil: number): string => {
    const retryAfterMinutes = Math.ceil((lockedUntil - Date.now()) / 60000);
    return `Too many invalid verification attempts. Request a new code in ${Math.max(retryAfterMinutes, 1)} minute(s).`;
};

const getForgotPasswordLockMessage = (lockedUntil: number): string => {
    const retryAfterMinutes = Math.ceil((lockedUntil - Date.now()) / 60000);
    return `Too many invalid reset attempts. Request a new reset code in ${Math.max(retryAfterMinutes, 1)} minute(s).`;
};

export const loginUser = async ({ email, password }: { email: string; password: string }) => {
    const sanitizedEmail = email.trim();

    const existUser = await User.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+password");
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    const isValidPassword = await compareDoHash(password, existUser.password as string);
    if (!isValidPassword) throw new ResponseError(400, "Invalid credentials!");

    if (!existUser.verified) {
        throw new ResponseError(403, "Account not verified. Please verify your account first.");
    }

    const token = jwt.sign(
        {
            userId: existUser._id,
            email: existUser.email,
            verified: existUser.verified,
        },
        process.env.ACCESS_TOKEN_PRIVATE_KEY as string,
        { expiresIn: "2h" },
    );

    return { token, userId: existUser._id, email: existUser.email };
};

export const sendVerificationCodeService = async (email: string) => {
    const sanitizedEmail = email.trim();

    const existUser = await User.findOne({ email: { $eq: sanitizedEmail } });
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    if (existUser.verified) throw new ResponseError(400, "User is already verified!");

    if (
        existUser.verificationCodeLockedUntil &&
        Date.now() < existUser.verificationCodeLockedUntil
    ) {
        throw new ResponseError(429, getVerificationLockMessage(existUser.verificationCodeLockedUntil));
    }

    const codeValue = generateVerificationCode();
    await sendVerifiedEmail(codeValue, existUser.email, existUser.fullName);

    existUser.verificationCode = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE as string);
    existUser.verificationCodeValidation = Date.now();
    existUser.verificationCodeAttempts = 0;
    existUser.verificationCodeLockedUntil = undefined;
    await existUser.save();

    return "Code sent successfully!";
};

export const verifyVerificationCodeService = async ({ value }: { value: Record<string, any> }) => {
    const codeValue = value.provided_code.toString();
    const sanitizedEmail = value.email.trim();

    const existUser = await User.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+verificationCode +verificationCodeValidation +verificationCodeAttempts +verificationCodeLockedUntil");
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    if (existUser.verified) throw new ResponseError(400, "User is verified!");

    if (
        existUser.verificationCodeLockedUntil &&
        Date.now() < existUser.verificationCodeLockedUntil
    ) {
        throw new ResponseError(429, getVerificationLockMessage(existUser.verificationCodeLockedUntil));
    }

    if (!existUser.verificationCode || !existUser.verificationCodeValidation)
        throw new ResponseError(400, "Something is wrong with the code!");

    if (Date.now() - (existUser.verificationCodeValidation as number) > VERIFICATION_CODE_TTL_MS) {
        existUser.verificationCode = undefined;
        existUser.verificationCodeValidation = undefined;
        existUser.verificationCodeAttempts = 0;
        await existUser.save();
        throw new ResponseError(400, "Code has been expired!");
    }

    const hashedCodeValue = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE as string);

    if (hashedCodeValue !== existUser.verificationCode) {
        const attempts = (existUser.verificationCodeAttempts ?? 0) + 1;

        if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
            existUser.verificationCode = undefined;
            existUser.verificationCodeValidation = undefined;
            existUser.verificationCodeAttempts = 0;
            existUser.verificationCodeLockedUntil = Date.now() + VERIFICATION_LOCK_MS;
            await existUser.save();
            throw new ResponseError(429, getVerificationLockMessage(existUser.verificationCodeLockedUntil));
        }

        existUser.verificationCodeAttempts = attempts;
        await existUser.save();
        throw new ResponseError(400, "Invalid verification code");
    }

    existUser.verified = true;
    existUser.verifiedAt = new Date();
    existUser.verificationCode = undefined;
    existUser.verificationCodeValidation = undefined;
    existUser.verificationCodeAttempts = 0;
    existUser.verificationCodeLockedUntil = undefined;
    await existUser.save();

    return "successfully verified!";
};

export const changePasswordService = async ({ value }: { value: Record<string, any> }) => {
    if (!value.verified) throw new ResponseError(400, "User not verified!");

    const existUser = await User.findOne({ _id: value.userId }).select("+password");
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    const result = await compareDoHash(value.old_password, existUser.password as string);
    if (!result) throw new ResponseError(400, "Invalid credentials!");

    const hashedPassword = await doHash(value.new_password, 12);
    existUser.password = hashedPassword;
    await existUser.save();

    return "Successfuly change password!";
};

export const changePasswordByAdminService = async ({ value }: { value: Record<string, any> }) => {
    const existUser = await User.findOne({ _id: value.userId }).select("+password");
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    const result = await compareDoHash(value.old_password, existUser.password as string);
    if (!result) throw new ResponseError(400, "Invalid credentials!");

    const hashedPassword = await doHash(value.new_password, 12);
    existUser.password = hashedPassword;
    await existUser.save();

    return "Successfuly change password!";
};

export const sendForgotPasswordService = async (email: string) => {
    const sanitizedEmail = email.trim();

    const existUser = await User.findOne({ email: { $eq: sanitizedEmail } });
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    if (
        existUser.forgotPasswordCodeLockedUntil &&
        Date.now() < existUser.forgotPasswordCodeLockedUntil
    ) {
        throw new ResponseError(429, getForgotPasswordLockMessage(existUser.forgotPasswordCodeLockedUntil));
    }

    const codeValue = Math.floor(Math.random() * 100000).toString();
    const url = generateForgotPasswordLink(existUser.email, codeValue);
    await sendForgotPasswordEmail(url, existUser.email, existUser.fullName);

    existUser.forgotPasswordCode = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE as string);
    existUser.forgotPasswordCodeValidation = Date.now();
    existUser.forgotPasswordCodeAttempts = 0;
    existUser.forgotPasswordCodeLockedUntil = undefined;
    await existUser.save();

    return "Send Email Reset Password Successfully";
};

export const verifyForgotPasswordCodeService = async ({ value }: { value: Record<string, any> }) => {
    const codeValue = value.provided_code.toString();
    const sanitizedEmail = value.email.trim();

    const existUser = await User.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+forgotPasswordCode +forgotPasswordCodeValidation +forgotPasswordCodeAttempts +forgotPasswordCodeLockedUntil");
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    if (
        existUser.forgotPasswordCodeLockedUntil &&
        Date.now() < existUser.forgotPasswordCodeLockedUntil
    ) {
        throw new ResponseError(429, getForgotPasswordLockMessage(existUser.forgotPasswordCodeLockedUntil));
    }

    if (!existUser.forgotPasswordCode || !existUser.forgotPasswordCodeValidation)
        throw new ResponseError(400, "Something is wrong with the code!");

    if (Date.now() - (existUser.forgotPasswordCodeValidation as number) > FORGOT_PASSWORD_TTL_MS) {
        existUser.forgotPasswordCode = undefined;
        existUser.forgotPasswordCodeValidation = undefined;
        existUser.forgotPasswordCodeAttempts = 0;
        await existUser.save();
        throw new ResponseError(400, "Code has been expired!");
    }

    const hashedCodeValue = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE as string);

    if (hashedCodeValue !== existUser.forgotPasswordCode) {
        const attempts = (existUser.forgotPasswordCodeAttempts ?? 0) + 1;

        if (attempts >= MAX_FORGOT_PASSWORD_ATTEMPTS) {
            existUser.forgotPasswordCode = undefined;
            existUser.forgotPasswordCodeValidation = undefined;
            existUser.forgotPasswordCodeAttempts = 0;
            existUser.forgotPasswordCodeLockedUntil = Date.now() + FORGOT_PASSWORD_LOCK_MS;
            await existUser.save();
            throw new ResponseError(429, getForgotPasswordLockMessage(existUser.forgotPasswordCodeLockedUntil));
        }

        existUser.forgotPasswordCodeAttempts = attempts;
        await existUser.save();
        throw new ResponseError(400, "Invalid reset code");
    }

    const hashedPassword = await doHash(value.new_password, 12);
    existUser.password = hashedPassword;
    existUser.forgotPasswordCode = undefined;
    existUser.forgotPasswordCodeValidation = undefined;
    existUser.forgotPasswordCodeAttempts = 0;
    existUser.forgotPasswordCodeLockedUntil = undefined;
    await existUser.save();

    return "Successfully update password";
};
