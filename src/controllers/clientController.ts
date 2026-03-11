import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { logActivity } from "../service/activityLogService.js";
import { getAuthActivityActor, getAdminActivityActor } from "../utils/activityActor.js";
import * as clientService from "../service/clientService.js";
import { clientSchema, clientUserUpdateSchema } from "../validators/clientValidator.js";

export const getAllClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
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
        const result = await clientService.getAllClients({
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

export const createClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { name, notifyUrl, userIds, active, availablePaymentIds } = req.body;
    const { adminId } = req.admin!;

    try {
        const { error, value } = clientSchema.validate({
            name,
            notifyUrl,
            userIds,
            active,
            adminId,
            availablePaymentIds,
        });
        if (error) return res.status(400).json({ success: false, message: error.details[0].message });

        const savedClient = await clientService.createClient({
            value,
        });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "CREATE_CLIENT",
                details: { clientId: savedClient.clientId, clientName: name },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        res.status(201).json({ success: true, message: "Client add successfully" });
    } catch (error) {
        logger.error(`Error add client: ${(error as Error).message}`);
        next(error);
    }
};

export const client = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;

    try {
        const { role, userId } = req.auth ?? {};
        const client = await clientService.client({ id, userId: role === "user" ? userId : undefined });

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

export const updateClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { name, notifyUrl, userIds, active, availablePaymentIds } = req.body;

    try {
        const { role, userId, adminId } = req.auth ?? {};
        let actor: ReturnType<typeof getAuthActivityActor> = getAuthActivityActor(req);

        if (role === "user") {
            const { error, value } = clientUserUpdateSchema.validate({
                name,
                notifyUrl,
                active,
            });
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error.details[0].message,
                });
            }

            const updatedClient = await clientService.updateClient({
                id,
                value,
                userId,
            });
            actor = getAuthActivityActor(req);

            if (actor) {
                logActivity({
                    actorId: actor.actorId,
                    role: actor.role,
                    action: "UPDATE_CLIENT",
                    details: { targetClientId: id, clientId: updatedClient.clientId, newName: name },
                    ipAddress: req.ip,
                }).catch(console.error);
            }
        } else {
            const { error, value } = clientSchema.validate({
                name,
                notifyUrl,
                userIds,
                active,
                adminId,
                availablePaymentIds,
            });
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error.details[0].message,
                });
            }
            const updatedClient = await clientService.updateClient({
                id,
                value,
            });

            if (actor) {
                logActivity({
                    actorId: actor.actorId,
                    role: actor.role,
                    action: "UPDATE_CLIENT",
                    details: { targetClientId: id, clientId: updatedClient.clientId, newName: name },
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

export const deleteClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { adminId } = req.admin!;

    try {
        const deletedClient = await clientService.deleteClient({
            id,
            adminId,
        });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "DELETE_CLIENT",
                details: { targetClientId: id, clientId: deletedClient.clientId, clientName: deletedClient.name },
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
