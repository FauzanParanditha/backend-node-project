import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import { logActivity } from "../service/activityLogService.js";
import * as authService from "../service/authService.js";
import * as authServiceUser from "../service/authServiceUser.js";
import Admin from "../models/adminModel.js";
import { getAuthActivityActor } from "../utils/activityActor.js";
import {
    acceptCodeSchema,
    acceptFPCodeSchema,
    changePasswordSchema,
    loginSchema,
} from "../validators/authValidator.js";

export const login = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { email, password } = req.body;

    try {
        const { error } = loginSchema.validate({ email, password });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        const {
            role,
            token,
            adminId,
            userId,
            email: loginEmail,
            expiresIn,
        } = await authService.loginUnified({
            email,
            password,
            clientIP: req.ip,
        });

        if (role === "user") {
            res.cookie("Authorization", "Bearer " + token, {
                expires: new Date(Date.now() + expiresIn * 1000),
                httpOnly: process.env.NODE_ENV === "production",
                secure: process.env.NODE_ENV === "production",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token,
                role,
                ...(adminId ? { adminId } : {}),
                ...(userId ? { userId } : {}),
                email: loginEmail,
                expiresIn,
            },
        });
    } catch (error) {
        logger.error(`Error login: ${(error as Error).message}`);
        next(error);
    }
};

export const logout = async (req: Request, res: Response): Promise<any> => {
    const actor = getAuthActivityActor(req);
    if (actor) {
        logActivity({
            actorId: actor.actorId,
            role: actor.role,
            action: "LOGOUT",
            ipAddress: req.ip,
        }).catch(console.error);
    }

    res.clearCookie("Authorization").status(200).json({
        success: true,
        message: "logout is successfully",
    });
};

export const sendVerificationCode = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { email } = req.body;
    const { role } = req.auth ?? {};

    try {
        let message;
        if (role === "admin" || role === "finance") {
            message = await authService.sendVerificationCodeService(email);
        } else if (role === "user") {
            message = await authServiceUser.sendVerificationCodeService(email);
        } else {
            throw new ResponseError(400, "Role not provided");
        }

        const actor = getAuthActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "REQUEST_VERIFICATION_CODE",
                details: { targetEmail: email },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        res.status(200).json({ success: true, message });
    } catch (error) {
        logger.error(`Error send verification code: ${(error as Error).message}`);
        next(error);
    }
};

export const verifyVerificationCode = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { email, provided_code } = req.body;
    try {
        const { error, value } = acceptCodeSchema.validate({
            email,
            provided_code,
        });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }
        const { role } = req.auth ?? {};

        let message;
        if (role === "admin" || role === "finance") {
            message = await authService.verifyVerificationCodeService({ value });
        } else if (role === "user") {
            message = await authServiceUser.verifyVerificationCodeService({ value });
        } else {
            throw new ResponseError(400, "Role not provided");
        }

        return res.status(200).json({
            success: true,
            message,
        });
    } catch (error) {
        logger.error(`Error verify verification code: ${(error as Error).message}`);
        next(error);
    }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { role, adminId, userId, verified } = req.auth ?? {};
    const { old_password, new_password } = req.body;

    try {
        if (!role) throw new ResponseError(400, "Role not provided");

        const isAdminRole = role === "admin" || role === "finance";
        const identityId = isAdminRole ? adminId : userId;
        const identityKey = isAdminRole ? "adminId" : "userId";

        const { error, value } = changePasswordSchema.validate({
            old_password,
            new_password,
            [identityKey]: identityId,
            verified,
        });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        let message;
        if (role === "admin" || role === "finance") {
            message = await authService.changePasswordService({ value });
        } else if (role === "user") {
            message = await authServiceUser.changePasswordService({ value });
        } else {
            throw new ResponseError(400, "Role not provided");
        }

        return res.status(200).json({
            success: true,
            message,
        });
    } catch (error) {
        logger.error(`Error change password: ${(error as Error).message}`);
        next(error);
    }
};

export const sendForgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { email } = req.body;
    try {
        const message = await authService.sendForgotPasswordService(email);

        // Pseudo log recording, actor state is omitted due to non-auth
        return res.status(200).json({
            success: true,
            message,
        });
    } catch (error) {
        logger.error(`Error send forgot password: ${(error as Error).message}`);
        next(error);
    }
};

export const verifyForgotPasswordCode = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { email, provided_code, new_password } = req.body;
    try {
        const { error, value } = acceptFPCodeSchema.validate({
            email,
            provided_code,
            new_password,
        });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        const message = await authService.verifyForgotPasswordCodeService({ value });
        const sanitizedEmail = email.trim();
        const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });

        logActivity({
            actorId: existAdmin ? String(existAdmin._id) : email,
            role: existAdmin?.role === "finance" ? "finance" : "admin",
            action: "RESET_PASSWORD",
            details: { resetEmail: email },
            ipAddress: req.ip,
        }).catch(console.error);

        return res.status(200).json({
            success: true,
            message,
        });
    } catch (error) {
        logger.error(`Error verify forgot password: ${(error as Error).message}`);
        next(error);
    }
};
