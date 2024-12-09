import * as clientService from "../service/clientService.js";
import logger from "../application/logger.js";
import { clientSchema } from "../validators/clientValidator.js";

export const getAllClient = async (req, res, next) => {
    const { query = "", limit = 10, page = 1, sort_by = "_id", sort = -1, countOnly = false } = req.query;

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
        logger.error(`Error fetching users: ${error.message}`);
        next(error);
    }
};

export const createClient = async (req, res, next) => {
    const { name, notifyUrl } = req.body;
    const { adminId } = req.admin;

    try {
        const { error } = clientSchema.validate({ name, notifyUrl, adminId });
        if (error) return res.status(401).json({ success: false, message: error.details[0].message });

        const client = await clientService.createClient({
            name,
            notifyUrl,
        });
        res.status(201).json({ success: true, message: "Client add successfully" });
    } catch (error) {
        logger.error(`Error add client: ${error.message}`);
        next(error);
    }
};

export const client = async (req, res, next) => {
    const { id } = req.params;

    try {
        const client = await clientService.client({ id });

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

export const updateClient = async (req, res, next) => {
    const { id } = req.params;
    const { name, notifyUrl } = req.body;
    const { adminId } = req.admin;

    try {
        const { error, value } = clientSchema.validate({ name, notifyUrl, adminId });
        if (error) {
            return res.status(401).json({
                success: false,
                message: error.details[0].message,
            });
        }

        const client = await clientService.updateClient({
            id,
            adminId,
            name,
            notifyUrl,
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

export const deleteClient = async (req, res, next) => {
    const { id } = req.params;
    const { adminId } = req.admin;

    try {
        const client = await clientService.deleteClient({
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
