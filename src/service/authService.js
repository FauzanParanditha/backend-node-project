import jwt from "jsonwebtoken";
import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import { compareDoHash, doHash, hmacProcess } from "../utils/helper.js";
import { generateForgotPasswordLink, sendForgotPasswordEmail, sendVerifiedEmail } from "./sendMail.js";

export const loginAdmin = async ({ email, password }) => {
    const sanitizedEmail = email.trim().toLowerCase();

    const existAdmin = await Admin.findOne({
        email: sanitizedEmail,
    }).select("+password");

    if (!existAdmin) {
        throw new ResponseError(400, "Invalid email or password");
    }

    const isValidPassword = await compareDoHash(password, existAdmin.password);

    if (!isValidPassword) {
        throw new ResponseError(400, "Invalid email or password");
    }

    const token = jwt.sign(
        {
            adminId: existAdmin._id.toString(),
            email: existAdmin.email,
            verified: existAdmin.verified,
            role: "admin",
        },
        process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY,
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

export const sendVerificationCodeService = async (email) => {
    const sanitizedEmail = email.trim();

    const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    if (existAdmin.verified) throw new ResponseError(400, "Admin is already verified!");

    const codeValue = Math.floor(100000 + Math.random() * 900000).toString();
    await sendVerifiedEmail(codeValue, existAdmin.email, existAdmin.fullName);

    // const info = await transport.sendMail({
    //     from: process.env.MAIL_ADDRESS,
    //     to: existAdmin.email,
    //     subject: "Verification code",
    //     html: `<h1>${codeValue}</h1>`,
    // });

    // if (info.accepted[0] !== existAdmin.email) throw new ResponseError(400, "Code sent failed!");

    existAdmin.verificationCode = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE);
    existAdmin.verificationCodeValidation = Date.now();
    await existAdmin.save();

    return "Code sent successfully!";
};

export const verifyVerificationCodeService = async ({ value }) => {
    const codeValue = value.provided_code.toString();
    const sanitizedEmail = value.email.trim();

    const existAdmin = await Admin.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+verificationCode +verificationCodeValidation");
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    if (existAdmin.verified) throw new ResponseError(400, "Admin is verified!");

    if (!existAdmin.verificationCode || !existAdmin.verificationCodeValidation)
        throw new ResponseError(400, "Something is wrong with the code!");

    if (Date.now() - existAdmin.verificationCodeValidation > 5 * 60 * 1000)
        throw new ResponseError(400, "Code has been expired!");

    const hashedCodeValue = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE);

    if (hashedCodeValue !== existAdmin.verificationCode) throw new ResponseError(400, "Unexpected occured!");

    existAdmin.verified = true;
    existAdmin.verificationCode = undefined;
    existAdmin.verificationCodeValidation = undefined;
    await existAdmin.save();

    return "successfully verified!";
};

export const changePasswordService = async ({ value }) => {
    if (!value.verified) throw new ResponseError(400, "Admin not verified!");

    const existAdmin = await Admin.findOne({ _id: value.adminId }).select("+password");
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    const result = await compareDoHash(value.old_password, existAdmin.password);
    if (!result) throw new ResponseError(400, "Invalid credentials!");

    const hashedPassword = await doHash(value.new_password, 12);
    existAdmin.password = hashedPassword;
    await existAdmin.save();

    return "Successfuly change password!";
};

export const sendForgotPasswordService = async (email) => {
    const sanitizedEmail = email.trim();

    const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });
    if (!existAdmin) return "Send Email Reset Password Successfully";

    const codeValue = Math.floor(Math.random() * 100000).toString();
    const url = generateForgotPasswordLink(existAdmin.email, codeValue);
    await sendForgotPasswordEmail(url, existAdmin.email, existAdmin.fullName);

    // let info = await transport.sendMail({
    //     from: process.env.MAIL_ADDRESS,
    //     to: existAdmin.email,
    //     subject: "Forgot password code",
    //     html: "<h1>" + codeValue + "</h1>",
    // });
    // if (info.accepted[0] !== existAdmin.email) throw new ResponseError(400, "Code sent failed!");

    existAdmin.forgotPasswordCode = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE);
    existAdmin.forgotPasswordCodeValidation = Date.now();
    await existAdmin.save();

    return "Send Email Reset Password Successfully";
};

export const verifyForgotPasswordCodeService = async ({ value }) => {
    const codeValue = value.provided_code.toString();
    const sanitizedEmail = value.email.trim();

    const existAdmin = await Admin.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+forgotPasswordCode +forgotPasswordCodeValidation");
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    if (!existAdmin.forgotPasswordCode || !existAdmin.forgotPasswordCodeValidation)
        throw new ResponseError(400, "Something is wrong with the code!");

    if (Date.now() - existAdmin.forgotPasswordCodeValidation > 5 * 60 * 1000)
        throw new ResponseError(400, "Code has been expired!");

    const hashedCodeValue = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE);

    if (hashedCodeValue !== existAdmin.forgotPasswordCode) throw new ResponseError(400, "Unexpected occured!");

    const hashedPassword = await doHash(value.new_password, 12);
    existAdmin.password = hashedPassword;
    existAdmin.forgotPasswordCode = undefined;
    await existAdmin.save();

    return "Successfully update password";
};
