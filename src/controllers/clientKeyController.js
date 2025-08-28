import logger from "../application/logger.js";
import * as clientKeyService from "../service/clientKeyService.js";
import { clientKeySchema } from "../validators/clientKeyValidator.js";

export const getAllClientKey = async (req, res, next) => {
    const { query = "", limit = 10, page = 1, sort_by = "_id", sort = -1, countOnly = false } = req.query;

    try {
        const result = await clientKeyService.getAllClients({
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
        logger.error(`Error fetching users: ${error.message}`);
        next(error);
    }
};

export const createClientKey = async (req, res, next) => {
    const { clientId, publicKey, active } = req.body;
    const { adminId } = req.admin;
    try {
        const { error, value } = clientKeySchema.validate({ clientId, publicKey, active, adminId });
        if (error) return res.status(400).json({ success: false, message: error.details[0].message });

        await clientKeyService.createClient({
            value,
        });
        res.status(201).json({ success: true, message: "Client add successfully" });
    } catch (error) {
        logger.error(`Error add client: ${error.message}`);
        next(error);
    }
};

export const clientKey = async (req, res, next) => {
    const { id } = req.params;

    try {
        const client = await clientKeyService.client({ id });

        return res.status(200).json({
            success: true,
            message: "client",
            data: client,
        });
    } catch (error) {
        logger.error(`Error fetching client: ${error.message}`);
        next(error);
    }
};

export const updateClientKey = async (req, res, next) => {
    const { id } = req.params;
    const { clientId, publicKey, active } = req.body;
    const { adminId } = req.admin;

    try {
        const { error, value } = clientKeySchema.validate({ clientId, publicKey, active, adminId });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        await clientKeyService.updateClient({
            id,
            value,
        });

        return res.status(200).json({
            success: true,
            message: "Successfully update client",
        });
    } catch (error) {
        logger.error(`Error update client address: ${error.message}`);
        next(error);
    }
};

export const deleteClientKey = async (req, res, next) => {
    const { id } = req.params;
    const { adminId } = req.admin;

    try {
        await clientKeyService.deleteClient({
            id,
            adminId,
        });
        return res.status(200).json({
            success: true,
            message: "Successfully delete client",
        });
    } catch (error) {
        logger.error(`Error delete client ${error.message}`);
        next(error);
    }
};
