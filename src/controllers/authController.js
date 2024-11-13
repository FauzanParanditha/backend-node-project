import jwt from "jsonwebtoken";
import {
  acceptCodeSchema,
  acceptFPCodeSchema,
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from "../validators/authValidator.js";
import Admin from "../models/adminModel.js";
import { compareDoHash, doHash, hmacProcess } from "../utils/helper.js";
import transport from "../middlewares/sendMail.js";
import logger from "../application/logger.js";

export const register = async (req, res) => {
  const { email, password, fullName } = req.body;

  try {
    const { error, value } = registerSchema.validate({
      email,
      password,
      fullName,
    });
    if (error) {
      return res.status(401).json({
        success: false,
        message: error.details[0].message,
      });
    }

    // check exist admin
    const existAdmin = await Admin.findOne({ email: email });
    if (existAdmin) {
      return res.status(401).json({
        success: false,
        message: "admin is alredy exist!",
      });
    }

    const hashPassword = await doHash(password, 12);

    const newAdmin = new Admin({
      email,
      password: hashPassword,
    });
    const result = await newAdmin.save();
    result.password = undefined;
    res.status(201).json({
      success: true,
      message: "register successfully",
      data: result,
    });
  } catch (error) {
    logger.error(`Error register: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const { error, value } = loginSchema.validate({ email, password });
    if (error) {
      return res.status(401).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const existAdmin = await Admin.findOne({ email: email }).select(
      "+password"
    );
    if (!existAdmin) {
      return res.status(401).json({
        success: false,
        message: "admin is not exist!",
      });
    }

    const result = await compareDoHash(password, existAdmin.password);
    if (!result) {
      return res.status(401).json({
        success: false,
        message: "invalid credentials!",
      });
    }

    const token = jwt.sign(
      {
        adminId: existAdmin._id,
        email: existAdmin.email,
        verified: existAdmin.verified,
      },
      process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY,
      {
        expiresIn: "2h",
      }
    );

    res
      .cookie("Authorization", "Bearer " + token, {
        expires: new Date(Date.now() + 2 * 3600000),
        httpOnly: process.env.NODE_ENV === "production",
        secure: process.env.NODE_ENV === "production",
      })
      .status(200)
      .json({
        success: true,
        message: "login is successfully",
        token,
      });
  } catch (error) {
    logger.error(`Error login: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const logout = async (req, res) => {
  res.clearCookie("Authorization").status(200).json({
    success: true,
    message: "logout is successfully",
  });
};

export const sendVerficationCode = async (req, res) => {
  const { email } = req.body;
  try {
    const existAdmin = await Admin.findOne({ email: email });
    if (!existAdmin) {
      return res.status(404).json({
        success: false,
        message: "admin is not exist!",
      });
    }
    if (existAdmin.verified) {
      return res.status(400).json({
        success: false,
        message: "admin is verified!",
      });
    }

    const codeValue = Math.floor(Math.random() * 1000000).toString();

    let info = await transport.sendMail({
      from: process.env.MAIL_ADDRESS,
      to: existAdmin.email,
      subject: "Verification code",
      html: "<h1>" + codeValue + "</h1>",
    });
    if (info.accepted[0] === existAdmin.email) {
      const hashCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE
      );
      existAdmin.verificationCode = hashCodeValue;
      existAdmin.verificationCodeValidation = Date.now();
      await existAdmin.save();
      return res.status(200).json({
        success: true,
        message: "code sent",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "code sent failed!",
      });
    }
  } catch (error) {
    logger.error(`Error send verification code: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const verifyVerificationCode = async (req, res) => {
  const { email, provided_code } = req.body;
  try {
    const { error, value } = acceptCodeSchema.validate({
      email,
      provided_code,
    });
    if (error) {
      return res.status(401).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const codeValue = provided_code.toString();
    const existAdmin = await Admin.findOne({ email: email }).select(
      "+verificationCode +verificationCodeValidation"
    );
    if (!existAdmin) {
      return res.status(401).json({
        success: false,
        message: "admin is not exist!",
      });
    }

    if (existAdmin.verified) {
      return res.status(400).json({
        success: false,
        message: "admin is verified!",
      });
    }

    if (
      !existAdmin.verificationCode ||
      !existAdmin.verificationCodeValidation
    ) {
      return res.status(400).json({
        success: false,
        message: "something is wrong with the code!",
      });
    }

    if (Date.now() - existAdmin.verificationCodeValidation > 5 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: "code has been expired!",
      });
    }

    const hashedCodeValue = hmacProcess(
      codeValue,
      process.env.HMAC_VERIFICATION_CODE
    );

    if (hashedCodeValue == existAdmin.verificationCode) {
      existAdmin.verified = true;
      existAdmin.verificationCode = undefined;
      existAdmin.verificationCodeValidation = undefined;
      await existAdmin.save();
      return res.status(200).json({
        success: true,
        message: "successfully verified!",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "unexpected occured!",
      });
    }
  } catch (error) {
    logger.error(`Error verify verification code: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const changePassword = async (req, res) => {
  const { adminId, verified } = req.admin;
  const { old_password, new_password } = req.body;

  try {
    const { error, value } = changePasswordSchema.validate({
      old_password,
      new_password,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    if (!verified) {
      return res.status(401).json({
        success: false,
        message: "admin not verified!",
      });
    }

    const existAdmin = await Admin.findOne({ _id: adminId }).select(
      "+password"
    );
    if (!existAdmin) {
      return res.status(401).json({
        success: false,
        message: "admin is not exist!",
      });
    }

    const result = await compareDoHash(old_password, existAdmin.password);
    if (!result) {
      return res.status(401).json({
        success: false,
        message: "invalid credentials!",
      });
    }

    const hashedPassword = await doHash(new_password, 12);
    existAdmin.password = hashedPassword;
    await existAdmin.save();
    return res.status(200).json({
      success: true,
      message: "successfuly change password!",
    });
  } catch (error) {
    logger.error(`Error change password: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const sendForgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const existAdmin = await Admin.findOne({ email: email });
    if (!existAdmin) {
      return res.status(404).json({
        success: false,
        message: "admin is not exist",
      });
    }

    const codeValue = Math.floor(Math.random() * 100000).toString();
    let info = await transport.sendMail({
      from: process.env.MAIL_ADDRESS,
      to: existAdmin.email,
      subject: "Forgot password code",
      html: "<h1>" + codeValue + "</h1>",
    });
    if (info.accepted[0] === existAdmin.email) {
      const hashedCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE
      );
      (existAdmin.forgotPasswordCode = hashedCodeValue),
        (existAdmin.forgotPasswordCodeValidation = Date.now());
      await existAdmin.save();
      return res.status(200).json({
        success: true,
        message: "code sent!",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "code sent failed!",
      });
    }
  } catch (error) {
    logger.error(`Error send forgot password: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const verifyForgotPasswordCode = async (req, res) => {
  const { email, provided_code, new_password } = req.body;
  try {
    const { error, value } = acceptFPCodeSchema.validate({
      email,
      provided_code,
      new_password,
    });
    if (error) {
      return res.status(401).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const codeValue = provided_code.toString();
    const existAdmin = await Admin.findOne({ email: email }).select(
      "+forgotPasswordCode +forgotPasswordCodeValidation"
    );
    if (!existAdmin) {
      return res.status(401).json({
        success: false,
        message: "admin is not exist!",
      });
    }
    if (
      !existAdmin.forgotPasswordCode ||
      !existAdmin.forgotPasswordCodeValidation
    ) {
      return res.status(400).json({
        success: false,
        message: "something is wrong with the code!",
      });
    }

    if (Date.now() - existAdmin.forgotPasswordCodeValidation > 5 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: "code has been expired!",
      });
    }

    const hashedCodeValue = hmacProcess(
      codeValue,
      process.env.HMAC_VERIFICATION_CODE
    );
    if (hashedCodeValue === existAdmin.forgotPasswordCode) {
      const hashedPassword = await doHash(new_password, 12);
      existAdmin.password = hashedPassword;
      existAdmin.forgotPasswordCode = undefined;
      await existAdmin.save();
      return res.status(200).json({
        success: true,
        message: "successfully update password",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "unexpected occured!",
      });
    }
  } catch (error) {
    logger.error(`Error verify forgot password: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
