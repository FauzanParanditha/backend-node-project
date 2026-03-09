import jwt from "jsonwebtoken";
import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import IPWhitelist from "../models/ipWhitelistModel.js";
import User from "../models/userModel.js";
import { compareDoHash, doHash, hmacProcess, normalizeIP } from "../utils/helper.js";
import { generateForgotPasswordLink, sendForgotPasswordEmail, sendVerifiedEmail } from "./sendMail.js";

export const loginAdmin = async ({ email, password }: { email: string; password: string }) => {
    const sanitizedEmail = email.trim().toLowerCase();

    const existAdmin = await Admin.findOne({
        email: sanitizedEmail,
    }).select("+password");

    if (!existAdmin) {
        throw new ResponseError(400, "Invalid email or password");
    }

    const isValidPassword = await compareDoHash(password, existAdmin.password as string);

    if (!isValidPassword) {
        throw new ResponseError(400, "Invalid email or password");
    }

    const role = existAdmin.role || "admin";
    const token = jwt.sign(
        {
            adminId: String(existAdmin._id),
            email: existAdmin.email,
            verified: existAdmin.verified,
            role,
        },
        process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY as string,
        {
            expiresIn: "1h",
            issuer: "dashboard.payhub.id",
            audience: "admin",
        },
    );

    return {
        token,
        adminId: existAdmin._id,
        email: existAdmin.email,
    };
};

export const loginUnified = async ({
    email,
    password,
    clientIP,
}: {
    email: string;
    password: string;
    clientIP?: string;
}) => {
    const sanitizedEmail = email.trim().toLowerCase();

    const existAdmin = await Admin.findOne({
        email: sanitizedEmail,
    }).select("+password");

    if (existAdmin) {
        if (!clientIP) throw new ResponseError(400, "Client IP not provided");

        const normalizedIP = normalizeIP(clientIP);
        const whitelistedIP = await IPWhitelist.findOne({
            ipAddress: normalizedIP,
        });

        if (!whitelistedIP) {
            throw new ResponseError(403, "Access forbidden");
        }

        const isValidPassword = await compareDoHash(password, existAdmin.password as string);

        if (!isValidPassword) {
            throw new ResponseError(400, "Invalid email or password");
        }

        const role = existAdmin.role || "admin";
        const token = jwt.sign(
            {
                adminId: String(existAdmin._id),
                email: existAdmin.email,
                verified: existAdmin.verified,
                role,
            },
            process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY as string,
            {
                expiresIn: "1h",
                issuer: "dashboard.payhub.id",
                audience: "admin",
            },
        );

        return {
            role,
            token,
            adminId: existAdmin._id,
            email: existAdmin.email,
            expiresIn: 3600,
        };
    }

    const existUser = await User.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+password");

    if (!existUser) throw new ResponseError(400, "Invalid email or password");

    const isValidPassword = await compareDoHash(password, existUser.password as string);
    if (!isValidPassword) throw new ResponseError(400, "Invalid email or password");

    const token = jwt.sign(
        {
            userId: existUser._id,
            email: existUser.email,
            verified: existUser.verified,
            role: "user",
        },
        process.env.ACCESS_TOKEN_PRIVATE_KEY as string,
        { expiresIn: "2h" },
    );

    return {
        role: "user",
        token,
        userId: existUser._id,
        email: existUser.email,
        expiresIn: 7200,
    };
};

export const sendVerificationCodeService = async (email: string) => {
    const sanitizedEmail = email.trim();

    const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    if (existAdmin.verified) throw new ResponseError(400, "Admin is already verified!");

    const codeValue = Math.floor(100000 + Math.random() * 900000).toString();
    await sendVerifiedEmail(codeValue, existAdmin.email, existAdmin.fullName);

    existAdmin.verificationCode = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE as string);
    existAdmin.verificationCodeValidation = Date.now();
    await existAdmin.save();

    return "Code sent successfully!";
};

export const verifyVerificationCodeService = async ({ value }: { value: Record<string, any> }) => {
    const codeValue = value.provided_code.toString();
    const sanitizedEmail = value.email.trim();

    const existAdmin = await Admin.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+verificationCode +verificationCodeValidation");
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    if (existAdmin.verified) throw new ResponseError(400, "Admin is verified!");

    if (!existAdmin.verificationCode || !existAdmin.verificationCodeValidation)
        throw new ResponseError(400, "Something is wrong with the code!");

    if (Date.now() - (existAdmin.verificationCodeValidation as number) > 5 * 60 * 1000)
        throw new ResponseError(400, "Code has been expired!");

    const hashedCodeValue = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE as string);

    if (hashedCodeValue !== existAdmin.verificationCode) throw new ResponseError(400, "Unexpected occured!");

    existAdmin.verified = true;
    existAdmin.verificationCode = undefined;
    existAdmin.verificationCodeValidation = undefined;
    await existAdmin.save();

    return "successfully verified!";
};

export const changePasswordService = async ({ value }: { value: Record<string, any> }) => {
    if (!value.verified) throw new ResponseError(400, "Admin not verified!");

    const existAdmin = await Admin.findOne({ _id: value.adminId }).select("+password");
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    const result = await compareDoHash(value.old_password, existAdmin.password as string);
    if (!result) throw new ResponseError(400, "Invalid credentials!");

    const hashedPassword = await doHash(value.new_password, 12);
    existAdmin.password = hashedPassword;
    await existAdmin.save();

    return "Successfuly change password!";
};

export const sendForgotPasswordService = async (email: string) => {
    const sanitizedEmail = email.trim();

    const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });
    if (!existAdmin) return "Send Email Reset Password Successfully";

    const codeValue = Math.floor(Math.random() * 100000).toString();
    const url = generateForgotPasswordLink(existAdmin.email, codeValue);
    await sendForgotPasswordEmail(url, existAdmin.email, existAdmin.fullName);

    existAdmin.forgotPasswordCode = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE as string);
    existAdmin.forgotPasswordCodeValidation = Date.now();
    await existAdmin.save();

    return "Send Email Reset Password Successfully";
};

export const verifyForgotPasswordCodeService = async ({ value }: { value: Record<string, any> }) => {
    const codeValue = value.provided_code.toString();
    const sanitizedEmail = value.email.trim();

    const existAdmin = await Admin.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+forgotPasswordCode +forgotPasswordCodeValidation");
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    if (!existAdmin.forgotPasswordCode || !existAdmin.forgotPasswordCodeValidation)
        throw new ResponseError(400, "Something is wrong with the code!");

    if (Date.now() - (existAdmin.forgotPasswordCodeValidation as number) > 5 * 60 * 1000)
        throw new ResponseError(400, "Code has been expired!");

    const hashedCodeValue = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE as string);

    if (hashedCodeValue !== existAdmin.forgotPasswordCode) throw new ResponseError(400, "Unexpected occured!");

    const hashedPassword = await doHash(value.new_password, 12);
    existAdmin.password = hashedPassword;
    existAdmin.forgotPasswordCode = undefined;
    await existAdmin.save();

    return "Successfully update password";
};
