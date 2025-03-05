import logger from "../application/logger.js";
import * as authService from "../service/authService.js";
import {
    acceptCodeSchema,
    acceptFPCodeSchema,
    changePasswordSchema,
    loginSchema,
} from "../validators/authValidator.js";

export const login = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        const { error } = loginSchema.validate({ email, password });
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }

        const { token } = await authService.loginAdmin({ email, password });
        res.cookie("dsbTkn", "Bearer " + token, {
            expires: new Date(Date.now() + 2 * 3600000),
            httpOnly: process.env.NODE_ENV === "production",
            secure: process.env.NODE_ENV === "production",
        })
            .status(200)
            .json({ success: true, message: "Login successful", token });
    } catch (error) {
        logger.error(`Error login: ${error.message}`);
        next(error);
    }
};

export const logout = async (req, res) => {
    res.clearCookie("Authorization").status(200).json({
        success: true,
        message: "logout is successfully",
    });
};

export const sendVerificationCode = async (req, res, next) => {
    const { email } = req.body;

    try {
        const message = await authService.sendVerificationCodeService(email);
        res.status(200).json({ success: true, message });
    } catch (error) {
        logger.error(`Error send verification code: ${error.message}`);
        next(error);
    }
};

export const verifyVerificationCode = async (req, res, next) => {
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
        const message = await authService.verifyVerificationCodeService({ value });
        return res.status(200).json({
            success: true,
            message,
        });
    } catch (error) {
        logger.error(`Error verify verification code: ${error.message}`);
        next(error);
    }
};

export const changePassword = async (req, res, next) => {
    const { adminId, verified } = req.admin;
    const { old_password, new_password } = req.body;

    try {
        const { error, value } = changePasswordSchema.validate({
            old_password,
            new_password,
            adminId,
            verified,
        });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }
        const message = await authService.changePasswordService({ value });
        return res.status(200).json({
            success: true,
            message,
        });
    } catch (error) {
        logger.error(`Error change password: ${error.message}`);
        next(error);
    }
};

export const sendForgotPassword = async (req, res, next) => {
    const { email } = req.body;
    try {
        const message = await authService.sendForgotPasswordService(email);
        return res.status(200).json({
            success: true,
            message,
        });
    } catch (error) {
        logger.error(`Error send forgot password: ${error.message}`);
        next(error);
    }
};

export const verifyForgotPasswordCode = async (req, res, next) => {
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

        const message = await authService.verifyForgotPasswordCodeService({ value });

        return res.status(200).json({
            success: true,
            message,
        });
    } catch (error) {
        logger.error(`Error verify forgot password: ${error.message}`);
        next(error);
    }
};
