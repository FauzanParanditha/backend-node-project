import transport from "../middlewares/sendMail.js";
import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";
import { compareDoHash, doHash, hmacProcess } from "../utils/helper.js";
import { ResponseError } from "../error/responseError.js";
import { generateForgotPasswordLink, sendForgotPasswordEmail } from "./sendMail.js";

export const loginAdmin = async ({ email, password }) => {
    const sanitizedEmail = email.trim();

    const existAdmin = await Admin.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+password");
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    const isValidPassword = await compareDoHash(password, existAdmin.password);
    if (!isValidPassword) throw new ResponseError(400, "Invalid credentials!");

    const token = jwt.sign(
        {
            adminId: existAdmin._id,
            email: existAdmin.email,
            verified: existAdmin.verified,
        },
        process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY,
        { expiresIn: "1h" },
    );

    return { token, adminId: existAdmin._id, email: existAdmin.email };
};

export const sendVerificationCodeService = async (email) => {
    const sanitizedEmail = email.trim();

    const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    if (existAdmin.verified) throw new ResponseError(400, "Admin is already verified!");

    const codeValue = Math.floor(Math.random() * 1000000).toString();
    const info = await transport.sendMail({
        from: process.env.MAIL_ADDRESS,
        to: existAdmin.email,
        subject: "Verification code",
        html: `<h1>${codeValue}</h1>`,
    });

    if (info.accepted[0] !== existAdmin.email) throw new ResponseError(400, "Code sent failed!");

    existAdmin.verificationCode = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE);
    existAdmin.verificationCodeValidation = Date.now();
    await existAdmin.save();

    return "Code sent successfully!";
};

export const verifyVerificationCodeService = async (email, provided_code) => {
    const codeValue = provided_code.toString();
    const sanitizedEmail = email.trim();

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

export const changePasswordService = async (adminId, verified, old_password, new_password) => {
    if (!verified) throw new ResponseError(400, "Admin not verified!");

    const existAdmin = await Admin.findOne({ _id: adminId }).select("+password");
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    const result = await compareDoHash(old_password, existAdmin.password);
    if (!result) throw new ResponseError(400, "Invalid credentials!");

    const hashedPassword = await doHash(new_password, 12);
    existAdmin.password = hashedPassword;
    await existAdmin.save();

    return "Successfuly change password!";
};

export const sendForgotPasswordService = async (email) => {
    const sanitizedEmail = email.trim();

    const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    const codeValue = Math.floor(Math.random() * 100000).toString();
    const url = generateForgotPasswordLink(existAdmin.email, codeValue);
    const result = await sendForgotPasswordEmail(url, existAdmin.email, existAdmin.fullName);

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

    return "Code send successfully!";
};

export const verifyForgotPasswordCodeService = async (email, provided_code, new_password) => {
    const codeValue = provided_code.toString();
    const sanitizedEmail = email.trim();

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

    const hashedPassword = await doHash(new_password, 12);
    existAdmin.password = hashedPassword;
    existAdmin.forgotPasswordCode = undefined;
    await existAdmin.save();

    return "Successfully update password";
};
