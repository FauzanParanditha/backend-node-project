import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import * as roleService from "../service/roleService.js";
import { createRoleSchema, updateRoleSchema } from "../validators/roleValidator.js";
import { getAdminActivityActor } from "../utils/activityActor.js";
import { logActivity } from "../service/activityLogService.js";

/**
 * GET /api/v1/roles
 */
export const getAllRoles = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const roles = await roleService.getAllRoles();
        res.status(200).json({ success: true, data: roles });
    } catch (error) {
        logger.error(`Error getAllRoles: ${(error as Error).message}`);
        next(error);
    }
};

/**
 * GET /api/v1/role/:id
 */
export const getRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const role = await roleService.getRoleById(req.params.id);
        res.status(200).json({ success: true, data: role });
    } catch (error) {
        logger.error(`Error getRole: ${(error as Error).message}`);
        next(error);
    }
};

/**
 * POST /api/v1/role
 */
export const createRole = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { error } = createRoleSchema.validate(req.body);
        if (error) return res.status(400).json({ success: false, message: error.details[0].message });

        const role = await roleService.createRole(req.body);

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "CREATE_ROLE",
                details: { roleName: role.name, permissions: role.permissions },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        res.status(201).json({ success: true, data: role });
    } catch (error) {
        logger.error(`Error createRole: ${(error as Error).message}`);
        next(error);
    }
};

/**
 * PUT /api/v1/role/:id
 */
export const updateRole = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { error } = updateRoleSchema.validate(req.body);
        if (error) return res.status(400).json({ success: false, message: error.details[0].message });

        const role = await roleService.updateRole(req.params.id, req.body);

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "UPDATE_ROLE",
                details: { roleId: req.params.id, roleName: role.name },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        res.status(200).json({ success: true, data: role });
    } catch (error) {
        logger.error(`Error updateRole: ${(error as Error).message}`);
        next(error);
    }
};

/**
 * DELETE /api/v1/role/:id
 */
export const deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        await roleService.deleteRole(req.params.id);

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "DELETE_ROLE",
                details: { roleId: req.params.id },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        res.status(200).json({ success: true, message: "Role deleted successfully" });
    } catch (error) {
        logger.error(`Error deleteRole: ${(error as Error).message}`);
        next(error);
    }
};

/**
 * GET /api/v1/permissions
 */
export const getPermissions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const data = roleService.getAvailablePermissions();
        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error(`Error getPermissions: ${(error as Error).message}`);
        next(error);
    }
};
