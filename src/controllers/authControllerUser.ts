import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import User from "../models/userModel.js";
import { logActivity } from "../service/activityLogService.js";
import * as authService from "../service/authService.js";
import * as authServiceUser from "../service/authServiceUser.js";
import { sendAuthAlert } from "../service/discordService.js";
import { getAuthActivityActor, resolveActivityActor } from "../utils/activityActor.js";
import { isAdminRole, normalizeAdminActivityRole } from "../utils/authRole.js";
import {
    acceptCodeSchema,
    acceptFPCodeSchema,
    changePasswordSchema,
    loginSchema,
} from "../validators/authValidator.js";

const PUBLIC_VERIFICATION_RESPONSE = "If the account exists, a verification code will be sent.";
const PUBLIC_RESET_RESPONSE = "If the account exists, a reset instruction will be sent.";
const PUBLIC_INVALID_CODE_RESPONSE = "Invalid or expired code";

export const login = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { email, password } = req.body;

    try {
        const { error } = loginSchema.validate({ email, password });
        if (error) {
            sendAuthAlert("Failed Login (Validation)", req.ip || "Unknown IP", email, error.details[0].message).catch(
                console.error,
            );
            return res.status(400).json({ success: false, message: error.details[0].message });
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

        sendAuthAlert("Successful Login", req.ip || "Unknown IP", email, `Successfully logged in as **${role}**`).catch(
            console.error,
        );

        // Record Activity Log asynchronously
        const actor = resolveActivityActor({
            role,
            adminId: adminId ? String(adminId) : undefined,
            userId: userId ? String(userId) : undefined,
        });
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "LOGIN",
                details: { email: loginEmail },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        res.status(200).json({
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
        sendAuthAlert("Failed Login (Credentials)", req.ip || "Unknown IP", email, (error as Error).message).catch(
            console.error,
        );
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

    try {
        await authServiceUser.sendVerificationCodeService(email);

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

        res.status(200).json({ success: true, message: PUBLIC_VERIFICATION_RESPONSE });
    } catch (error) {
        if (error instanceof ResponseError && [400, 404, 429].includes(error.status)) {
            logger.warn(`Masked send verification response: ${error.message}`);
            return res.status(200).json({ success: true, message: PUBLIC_VERIFICATION_RESPONSE });
        }
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
        const existingUser = await User.findOne({ email: value.email.trim() });
        if (!existingUser) {
            throw new ResponseError(400, PUBLIC_INVALID_CODE_RESPONSE);
        }

        const message = await authServiceUser.verifyVerificationCodeService({ value });

        const actor = getAuthActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "VERIFY_CODE",
                details: { email },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        return res.status(200).json({
            success: true,
            message,
        });
    } catch (error) {
        if (error instanceof ResponseError && [400, 404, 429].includes(error.status)) {
            logger.warn(`Masked verify verification response: ${error.message}`);
            return res.status(400).json({
                success: false,
                errors: PUBLIC_INVALID_CODE_RESPONSE,
            });
        }
        logger.error(`Error verify verification code: ${(error as Error).message}`);
        next(error);
    }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { userId, verified } = req.user!;
    const { old_password, new_password } = req.body;

    try {
        const { error, value } = changePasswordSchema.validate({
            old_password,
            new_password,
            userId,
            verified,
        });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }
        const message = await authServiceUser.changePasswordService({ value });

        logActivity({
            actorId: userId.toString(),
            role: "user",
            action: "CHANGE_PASSWORD",
            ipAddress: req.ip,
        }).catch(console.error);

        return res.status(200).json({
            success: true,
            message,
        });
    } catch (error) {
        logger.error(`Error change password: ${(error as Error).message}`);
        next(error);
    }
};

export const changePasswordByAdmin = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { old_password, new_password, userId } = req.body;

    try {
        const { error, value } = changePasswordSchema.validate({
            old_password,
            new_password,
            userId,
        });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }
        const message = await authServiceUser.changePasswordByAdminService({ value });

        const actor = getAuthActivityActor(req);
        if (actor && isAdminRole(actor.role)) {
            logActivity({
                actorId: actor.actorId,
                role: normalizeAdminActivityRole(actor.role),
                action: "CHANGE_PASSWORD_BY_ADMIN",
                details: { targetUserId: userId },
                ipAddress: req.ip,
            }).catch(console.error);
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
        const sanitizedEmail = email.trim();
        const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });

        if (existAdmin) {
            await authService.sendForgotPasswordService(email);
        } else {
            const existingUser = await User.findOne({ email: { $eq: sanitizedEmail } });
            if (existingUser) {
                await authServiceUser.sendForgotPasswordService(email);
            }
        }

        // Unauthenticated request, using 'system' or 'user' pseudo actor based on existence?
        // Since we don't have an auth context, we will omit or log neutrally.
        // For Forgot Password, actorId is usually the target user if we fetch them.
        // Here we just log under pseudo 'user' role with email detail.

        return res.status(200).json({
            success: true,
            message: PUBLIC_RESET_RESPONSE,
        });
    } catch (error) {
        if (error instanceof ResponseError && [400, 404, 429].includes(error.status)) {
            logger.warn(`Masked send forgot password response: ${error.message}`);
            return res.status(200).json({
                success: true,
                message: PUBLIC_RESET_RESPONSE,
            });
        }
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

        const sanitizedEmail = email.trim();
        const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });

        let message: string;
        if (existAdmin) {
            message = await authService.verifyForgotPasswordCodeService({ value });
        } else {
            const existingUser = await User.findOne({ email: { $eq: sanitizedEmail } });
            if (!existingUser) {
                throw new ResponseError(400, PUBLIC_INVALID_CODE_RESPONSE);
            }
            message = await authServiceUser.verifyForgotPasswordCodeService({ value });
        }

        // Unauthenticated state resolution
        const actorIdentity = existAdmin ? existAdmin._id : email;
        logActivity({
            actorId: String(actorIdentity), // May not be an ObjectId if tracking email fallback
            role: existAdmin ? normalizeAdminActivityRole(existAdmin.role) : "user",
            action: "RESET_PASSWORD",
            details: { resetEmail: email },
            ipAddress: req.ip,
        }).catch(console.error);

        return res.status(200).json({
            success: true,
            message,
        });
    } catch (error) {
        if (error instanceof ResponseError && [400, 404, 429].includes(error.status)) {
            logger.warn(`Masked verify forgot password response: ${error.message}`);
            return res.status(400).json({
                success: false,
                errors: PUBLIC_INVALID_CODE_RESPONSE,
            });
        }
        logger.error(`Error verify forgot password: ${(error as Error).message}`);
        next(error);
    }
};
