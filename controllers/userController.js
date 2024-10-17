import jwt from "jsonwebtoken";
import {
  acceptCodeSchema,
  acceptFPCodeSchema,
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from "../middlewares/validator.js";
import User from "../models/userModel.js";
import { compareDoHash, doHash, hmacProcess } from "../utils/helper.js";
import transport from "../middlewares/sendMail.js";

export const register = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { error, value } = registerSchema.validate({ email, password });
    if (error) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: error.details[0].message,
      });
    }

    // check exist user
    const existUser = await User.findOne({ email: email });
    if (existUser) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "user is alredy exist!",
      });
    }

    const hashPassword = await doHash(password, 12);

    const newUser = new User({
      email,
      password: hashPassword,
    });
    const result = await newUser.save();
    result.password = undefined;
    res.status(201).json({
      success: true,
      code: 201,
      message: "register successfully",
      data: result,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      code: 500,
      message: error,
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
        code: 401,
        message: error.details[0].message,
      });
    }

    const existUser = await User.findOne({ email: email }).select("+password");
    if (!existUser) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "user is not exist!",
      });
    }

    const result = await compareDoHash(password, existUser.password);
    if (!result) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "invalid credentials!",
      });
    }

    const token = jwt.sign(
      {
        userId: existUser._id,
        email: existUser.email,
        verified: existUser.verified,
      },
      process.env.ACCESS_TOKEN_PRIVATE_KEY,
      {
        expiresIn: "8h",
      }
    );

    res
      .cookie("Authorization", "Bearer " + token, {
        expires: new Date(Date.now() + 8 * 3600000),
        httpOnly: process.env.NODE_ENV === "production",
        secure: process.env.NODE_ENV === "production",
      })
      .status(200)
      .json({
        success: true,
        code: 200,
        message: "login is successfully",
        token,
      });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      code: 500,
      message: error,
    });
  }
};

export const logout = async (req, res) => {
  res.clearCookie("Authorization").status(200).json({
    success: true,
    code: 200,
    message: "logout is successfully",
  });
};

export const sendVerficationCode = async (req, res) => {
  const { email } = req.body;
  try {
    const existUser = await User.findOne({ email: email });
    if (!existUser) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: "user is not exist!",
      });
    }
    if (existUser.verified) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "user is verified!",
      });
    }

    const codeValue = Math.floor(Math.random() * 1000000).toString();

    let info = await transport.sendMail({
      from: process.env.MAIL_ADDRESS,
      to: existUser.email,
      subject: "Verification code",
      html: "<h1>" + codeValue + "</h1>",
    });
    if (info.accepted[0] === existUser.email) {
      const hashCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE
      );
      existUser.verificationCode = hashCodeValue;
      existUser.verificationCodeValidation = Date.now();
      await existUser.save();
      return res.status(200).json({
        success: true,
        code: 200,
        message: "code sent",
      });
    } else {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "code sent failed!",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      code: 500,
      message: error,
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
        code: 401,
        message: error.details[0].message,
      });
    }

    const codeValue = provided_code.toString();
    const existUser = await User.findOne({ email: email }).select(
      "+verificationCode +verificationCodeValidation"
    );
    if (!existUser) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "user is not exist!",
      });
    }

    if (existUser.verified) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "user is verified!",
      });
    }

    if (!existUser.verificationCode || !existUser.verificationCodeValidation) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "something is wrong with the code!",
      });
    }

    if (Date.now() - existUser.verificationCodeValidation > 5 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "code has been expired!",
      });
    }

    const hashedCodeValue = hmacProcess(
      codeValue,
      process.env.HMAC_VERIFICATION_CODE
    );

    if (hashedCodeValue == existUser.verificationCode) {
      existUser.verified = true;
      existUser.verificationCode = undefined;
      existUser.verificationCodeValidation = undefined;
      await existUser.save();
      return res.status(200).json({
        success: true,
        code: 200,
        message: "successfully verified!",
      });
    } else {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "unexpected occured!",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      code: 500,
      message: error,
    });
  }
};

export const changePassword = async (req, res) => {
  const { userId, verified } = req.user;
  const { old_password, new_password } = req.body;

  try {
    const { error, value } = changePasswordSchema.validate({
      old_password,
      new_password,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: error.details[0].message,
      });
    }

    if (!verified) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "user not verified!",
      });
    }

    const existUser = await User.findOne({ _id: userId }).select("+password");
    if (!existUser) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "user is not exist!",
      });
    }

    const result = await compareDoHash(old_password, existUser.password);
    if (!result) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "invalid credentials!",
      });
    }

    const hashedPassword = await doHash(new_password, 12);
    existUser.password = hashedPassword;
    await existUser.save();
    return res.status(200).json({
      success: true,
      code: 200,
      message: "successfuly change password!",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      code: 500,
      message: error,
    });
  }
};

export const sendForgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const existUser = await User.findOne({ email: email });
    if (!existUser) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: "user is not exist",
      });
    }

    const codeValue = Math.floor(Math.random() * 100000).toString();
    let info = await transport.sendMail({
      from: process.env.MAIL_ADDRESS,
      to: existUser.email,
      subject: "Forgot password code",
      html: "<h1>" + codeValue + "</h1>",
    });
    if (info.accepted[0] === existUser.email) {
      const hashedCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE
      );
      (existUser.forgotPasswordCode = hashedCodeValue),
        (existUser.forgotPasswordCodeValidation = Date.now());
      await existUser.save();
      return res.status(200).json({
        success: true,
        code: 200,
        message: "code sent!",
      });
    } else {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "code sent failed!",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      code: 500,
      message: error,
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
        code: 401,
        message: error.details[0].message,
      });
    }

    const codeValue = provided_code.toString();
    const existUser = await User.findOne({ email: email }).select(
      "+forgotPasswordCode +forgotPasswordCodeValidation"
    );
    if (existUser) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "user is not exist!",
      });
    }
    if (
      !existUser.forgotPasswordCode ||
      !existUser.forgotPasswordCodeValidation
    ) {
      return res.status(400).json({
        success: false,
        code: 401,
        message: "something is wrong with the code!",
      });
    }

    if (Date.now() - existUser.forgotPasswordCodeValidation > 5 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "code has been expired!",
      });
    }

    const hashedCodeValue = hmacProcess(
      codeValue,
      process.env.HMAC_VERIFICATION_CODE
    );
    if (hashedCodeValue === existUser.forgotPasswordCode) {
      const hashedPassword = await doHash(new_password, 12);
      existUser.password = hashedPassword;
      existUser.forgotPasswordCode = undefined;
      await existUser.save();
      return res.status(200).json({
        success: true,
        code: 200,
        message: "successfully update password",
      });
    } else {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "unexpected occured!",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      code: 500,
      message: error,
    });
  }
};
