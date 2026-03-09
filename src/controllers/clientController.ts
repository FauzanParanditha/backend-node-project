import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { logActivity } from "../service/activityLogService.js";
import * as clientService from "../service/clientService.js";
import { clientSchema } from "../validators/clientValidator.js";

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
        const result = await clientService.getAllClients({
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

        logActivity({
            actorId: adminId.toString(),
            role: "admin",
            action: "CREATE_CLIENT",
            details: { clientId: savedClient.clientId, clientName: name },
            ipAddress: req.ip,
        }).catch(console.error);

        res.status(201).json({ success: true, message: "Client add successfully" });
    } catch (error) {
        logger.error(`Error add client: ${(error as Error).message}`);
        next(error);
    }
};

export const client = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;

    try {
        const client = await clientService.client({ id });

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
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }
        await clientService.updateClient({
            id,
            value,
        });

        logActivity({
            actorId: adminId.toString(),
            role: "admin",
            action: "UPDATE_CLIENT",
            details: { targetClientId: id, newName: name },
            ipAddress: req.ip,
        }).catch(console.error);

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
        await clientService.deleteClient({
            id,
            adminId,
        });

        logActivity({
            actorId: adminId.toString(),
            role: "admin",
            action: "DELETE_CLIENT",
            details: { targetClientId: id },
            ipAddress: req.ip,
        }).catch(console.error);

        return res.status(200).json({
            success: true,
            message: "Successfully delete client",
        });
    } catch (error) {
        logger.error(`Error delete client ${(error as Error).message}`);
        next(error);
    }
};
