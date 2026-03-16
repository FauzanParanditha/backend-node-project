import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { logActivity } from "../service/activityLogService.js";
import { getAdminActivityActor } from "../utils/activityActor.js";
import * as userService from "../service/userService.js";
import { registerSchema, updateUserSchema } from "../validators/authValidator.js";

export const getAllUser = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const {
        query = "",
        limit = 10,
        page = 1,
        sort_by = "_id",
        sort = -1,
        countOnly = false,
    } = req.query as Record<string, any>;

    try {
        const result = await userService.getAllUsers({
            query,
            limit,
            page,
            sort_by,
            sort,
            countOnly,
        });

        if (countOnly) {
            return res.status(200).json({ count: result.count });
        }

        return res.status(200).json({
            success: true,
            message: "All users",
            data: result.users,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching users: ${(error as Error).message}`);
        next(error);
    }
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { email, password, fullName, roleId } = req.body;
    const { adminId } = req.admin!;

    try {
        const { error } = registerSchema.validate({ email, password, fullName, roleId });
        if (error) return res.status(400).json({ success: false, message: error.details[0].message });

        await userService.registerUser({
            email,
            password,
            fullName,
            roleId,
            adminId,
        });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "CREATE_USER",
                details: { newUserEmail: email },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        res.status(201).json({ success: true, message: "Registered successfully" });
    } catch (error) {
        logger.error(`Error register: ${(error as Error).message}`);
        next(error);
    }
};

export const user = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;

    try {
        const user = await userService.user({ id });

        return res.status(200).json({
            success: true,
            message: "user",
            data: user,
        });
    } catch (error) {
        logger.error(`Error fetching user: ${(error as Error).message}`);
        next(error);
    }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { fullName, email, roleId, verified } = req.body;
    const { adminId } = req.admin!;

    try {
        const { error, value } = updateUserSchema.validate({ fullName, email, roleId, verified });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        await userService.updateUser({
            id,
            value,
            adminId,
        });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "UPDATE_USER",
                details: { targetUserId: id },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        return res.status(200).json({
            success: true,
            message: "Successfully update user",
        });
    } catch (error) {
        logger.error(`Error update user address: ${(error as Error).message}`);
        next(error);
    }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { adminId } = req.admin!;

    try {
        await userService.deleteUserById(id, adminId);

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "DELETE_USER",
                details: { targetUserId: id },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        return res.status(200).json({
            success: true,
            message: "Successfully deleted user",
        });
    } catch (error) {
        logger.error(`Error deleting user: ${(error as Error).message}`);
        next(error);
    }
};
