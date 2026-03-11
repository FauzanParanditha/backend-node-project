import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { logActivity } from "../service/activityLogService.js";
import { getAdminActivityActor, getAuthActivityActor } from "../utils/activityActor.js";
import * as clientKeyService from "../service/clientKeyService.js";
import { clientKeySchema, clientKeyUserUpdateSchema } from "../validators/clientKeyValidator.js";

export const getAllClientKey = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const {
        query = "",
        limit = 10,
        page = 1,
        sort_by = "_id",
        sort = -1,
        countOnly = false,
    } = req.query as Record<string, any>;

    try {
        const { role, userId } = req.auth ?? {};
        const result = await clientKeyService.getAllClients({
            query,
            limit,
            page,
            sort_by,
            sort,
            countOnly,
            userId: role === "user" ? userId : undefined,
        });

        if (countOnly) {
            return res.status(200).json({ count: result.count });
        }

        return res.status(200).json({
            success: true,
            message: "All clients",
            data: result.clients,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching users: ${(error as Error).message}`);
        next(error);
    }
};

export const createClientKey = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { clientId, publicKey, active } = req.body;
    const { adminId } = req.admin!;
    try {
        const { error, value } = clientKeySchema.validate({ clientId, publicKey, active, adminId });
        if (error) return res.status(400).json({ success: false, message: error.details[0].message });

        await clientKeyService.createClient({
            value,
        });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "CREATE_API_KEY",
                details: { clientId },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        res.status(201).json({ success: true, message: "Client add successfully" });
    } catch (error) {
        logger.error(`Error add client: ${(error as Error).message}`);
        next(error);
    }
};

export const clientKey = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;

    try {
        const { role, userId } = req.auth ?? {};
        const client = await clientKeyService.client({ id, userId: role === "user" ? userId : undefined });

        return res.status(200).json({
            success: true,
            message: "client",
            data: client,
        });
    } catch (error) {
        logger.error(`Error fetching client: ${(error as Error).message}`);
        next(error);
    }
};

export const updateClientKey = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { clientId, publicKey, active } = req.body;

    try {
        const { role, userId, adminId } = req.auth ?? {};
        let actor = getAuthActivityActor(req);

        if (role === "user") {
            const { error, value } = clientKeyUserUpdateSchema.validate({ publicKey, active });
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error.details[0].message,
                });
            }

            const updatedClientKey = await clientKeyService.updateClient({
                id,
                value,
                userId,
            });

            if (actor) {
                logActivity({
                    actorId: actor.actorId,
                    role: actor.role,
                    action: "UPDATE_API_KEY",
                    details: { targetKeyId: id, clientId: updatedClientKey.clientId },
                    ipAddress: req.ip,
                }).catch(console.error);
            }
        } else {
            const { error, value } = clientKeySchema.validate({ clientId, publicKey, active, adminId });
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error.details[0].message,
                });
            }

            const updatedClientKey = await clientKeyService.updateClient({
                id,
                value,
            });

            if (actor) {
                logActivity({
                    actorId: actor.actorId,
                    role: actor.role,
                    action: "UPDATE_API_KEY",
                    details: { targetKeyId: id, clientId: updatedClientKey.clientId },
                    ipAddress: req.ip,
                }).catch(console.error);
            }
        }

        return res.status(200).json({
            success: true,
            message: "Successfully update client",
        });
    } catch (error) {
        logger.error(`Error update client address: ${(error as Error).message}`);
        next(error);
    }
};

export const deleteClientKey = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { adminId } = req.admin!;

    try {
        const deletedClientKey = await clientKeyService.deleteClient({
            id,
            adminId,
        });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "DELETE_API_KEY",
                details: { targetKeyId: id, clientId: deletedClientKey.clientId },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        return res.status(200).json({
            success: true,
            message: "Successfully delete client",
        });
    } catch (error) {
        logger.error(`Error delete client ${(error as Error).message}`);
        next(error);
    }
};
