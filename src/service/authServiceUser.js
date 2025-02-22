import jwt from "jsonwebtoken";
import { ResponseError } from "../error/responseError.js";
import transport from "../middlewares/sendMail.js";
import User from "../models/userModel.js";
import { compareDoHash, doHash, hmacProcess } from "../utils/helper.js";

export const loginUser = async ({ email, password }) => {
    const sanitizedEmail = email.trim();

    const existUser = await User.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+password");
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    const isValidPassword = await compareDoHash(password, existUser.password);
    if (!isValidPassword) throw new ResponseError(400, "Invalid credentials!");

    const token = jwt.sign(
        {
            userId: existUser._id,
            email: existUser.email,
            verified: existUser.verified,
        },
        process.env.ACCESS_TOKEN_PRIVATE_KEY,
        { expiresIn: "2h" },
    );

    return { token, userId: existUser._id, email: existUser.email };
};

export const sendVerificationCodeService = async (email) => {
    const sanitizedEmail = email.trim();

    const existUser = await User.findOne({ email: { $eq: sanitizedEmail } });
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    if (existUser.verified) throw new ResponseError(400, "User is already verified!");

    const codeValue = Math.floor(Math.random() * 1000000).toString();
    const info = await transport.sendMail({
        from: process.env.MAIL_ADDRESS,
        to: existUser.email,
        subject: "Verification code",
        html: `<h1>${codeValue}</h1>`,
    });

    if (info.accepted[0] !== existUser.email) throw new ResponseError(400, "Code sent failed!");

    existUser.verificationCode = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE);
    existUser.verificationCodeValidation = Date.now();
    await existUser.save();

    return "Code sent successfully!";
};

export const verifyVerificationCodeService = async ({ value }) => {
    const codeValue = value.provided_code.toString();
    const sanitizedEmail = value.email.trim();

    const existUser = await User.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+verificationCode +verificationCodeValidation");
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    if (existUser.verified) throw new ResponseError(400, "User is verified!");

    if (!existUser.verificationCode || !existUser.verificationCodeValidation)
        throw new ResponseError(400, "Something is wrong with the code!");

    if (Date.now() - existUser.verificationCodeValidation > 5 * 60 * 1000)
        throw new ResponseError(400, "Code has been expired!");

    const hashedCodeValue = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE);

    if (hashedCodeValue !== existUser.verificationCode) throw new ResponseError(400, "Unexpected occured!");

    existUser.verified = true;
    existUser.verificationCode = undefined;
    existUser.verificationCodeValidation = undefined;
    await existUser.save();

    return "successfully verified!";
};

export const changePasswordService = async ({ value }) => {
    if (!value.verified) throw new ResponseError(400, "User not verified!");

    const existUser = await User.findOne({ _id: value.userId }).select("+password");
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    const result = await compareDoHash(value.old_password, existUser.password);
    if (!result) throw new ResponseError(400, "Invalid credentials!");

    const hashedPassword = await doHash(value.new_password, 12);
    existUser.password = hashedPassword;
    await existUser.save();

    return "Successfuly change password!";
};

export const changePasswordByAdminService = async ({ value }) => {
    // if (!verified) throw new ResponseError(400, "User not verified!");

    const existUser = await User.findOne({ _id: value.userId }).select("+password");
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    const result = await compareDoHash(value.old_password, existUser.password);
    if (!result) throw new ResponseError(400, "Invalid credentials!");

    const hashedPassword = await doHash(value.new_password, 12);
    existUser.password = hashedPassword;
    await existUser.save();

    return "Successfuly change password!";
};

export const sendForgotPasswordService = async (email) => {
    const sanitizedEmail = email.trim();

    const existUser = await User.findOne({ email: { $eq: sanitizedEmail } });
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    const codeValue = Math.floor(Math.random() * 100000).toString();
    let info = await transport.sendMail({
        from: process.env.MAIL_ADDRESS,
        to: existUser.email,
        subject: "Forgot password code",
        html: "<h1>" + codeValue + "</h1>",
    });
    if (info.accepted[0] !== existUser.email) throw new ResponseError(400, "Code sent failed!");

    existUser.forgotPasswordCode = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE);
    existUser.forgotPasswordCodeValidation = Date.now();
    await existUser.save();

    return "Code send successfully!";
};

export const verifyForgotPasswordCodeService = async ({ value }) => {
    const codeValue = value.provided_code.toString();
    const sanitizedEmail = value.email.trim();

    const existUser = await User.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+forgotPasswordCode +forgotPasswordCodeValidation");
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    if (!existUser.forgotPasswordCode || !existUser.forgotPasswordCodeValidation)
        throw new ResponseError(400, "Something is wrong with the code!");

    if (Date.now() - existUser.forgotPasswordCodeValidation > 5 * 60 * 1000)
        throw new ResponseError(400, "Code has been expired!");

    const hashedCodeValue = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE);

    if (hashedCodeValue !== existUser.forgotPasswordCode) throw new ResponseError(400, "Unexpected occured!");

    const hashedPassword = await doHash(value.new_password, 12);
    existUser.password = hashedPassword;
    existUser.forgotPasswordCode = undefined;
    await existUser.save();

    return "Successfully update password";
};
