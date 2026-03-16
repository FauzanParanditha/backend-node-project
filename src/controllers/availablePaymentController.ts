import type { NextFunction, Request, Response } from "express";
import fs from "fs/promises";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import logger from "../application/logger.js";
import { logActivity } from "../service/activityLogService.js";
import * as availablePaymentService from "../service/availablePaymentService.js";
import { getAdminActivityActor } from "../utils/activityActor.js";
import { availablePaymentValidationSchema } from "../validators/availablePaymentValidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, "../public/payment");

export const availablePayments = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const {
        query = "",
        limit = 10,
        page = 1,
        sort_by = "_id",
        sort = -1,
        countOnly = false,
        clientId,
    } = req.query as Record<string, any>;

    try {
        const result = await availablePaymentService.getAllAvailablePayment({
            query,
            limit,
            page,
            sort_by,
            sort,
            countOnly,
            clientId,
        });

        if (countOnly) {
            return res.status(200).json({ count: result.count });
        }

        return res.status(200).json({
            success: true,
            message: "All available payment",
            data: result.availablePayment,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching available payments: ${(error as Error).message}`);
        next(error);
    }
};

export const createAvailablePayment = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { adminId } = req.admin!;

    try {
        const { error } = availablePaymentValidationSchema.validate({ ...req.body, adminId }, { abortEarly: false });

        if (error) {
            return res.status(400).json({
                success: false,
                errors: error.details.map((err) => err.message),
            });
        }

        await availablePaymentService.createAvailablePayment({ req, adminId });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "CREATE_AVAILABLE_PAYMENT",
                ipAddress: req.ip,
            }).catch(console.error);
        }

        return res.status(201).json({
            success: true,
            message: "Successfully create available payment",
        });
    } catch (error) {
        logger.error(`Error create available payment: ${(error as Error).message}`);

        if (req.file?.path) {
            try {
                const filePath = path.resolve(UPLOADS_DIR, path.basename(req.file.path));

                if (filePath.startsWith(UPLOADS_DIR)) {
                    // Cek apakah file benar-benar ada sebelum dihapus
                    const fileExists = await fs
                        .access(filePath)
                        .then(() => true)
                        .catch(() => false);

                    if (fileExists) {
                        await fs.unlink(filePath);
                        logger.log("Deleted unused image:", filePath);
                    } else {
                        logger.error("File not found, skipping deletion:", filePath);
                    }
                } else {
                    logger.error("Invalid file path detected:", filePath);
                }
            } catch (unlinkError) {
                logger.error("Failed to delete unused image:", unlinkError);
            }
        }

        next(error);
    }
};

export const availablePayment = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;

    try {
        const { role, userId } = req.auth ?? {};

        const product = await availablePaymentService.availablePayment({
            id,
            userId: role === "user" ? userId : undefined,
        });

        return res.status(200).json({
            success: true,
            message: "Available Payment",
            data: product,
        });
    } catch (error) {
        logger.error(`Error fetching available payment: ${(error as Error).message}`);
        next(error);
    }
};

export const updateAvailablePayment = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { adminId } = req.admin!;

    try {
        const { error, value } = availablePaymentValidationSchema.validate(
            { ...req.body, adminId },
            { abortEarly: false },
        );

        if (error) {
            return res.status(400).json({
                success: false,
                errors: error.details.map((err) => err.message),
            });
        }

        await availablePaymentService.updateAvailablePayment({
            id,
            adminId,
            value,
            req,
        });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "UPDATE_AVAILABLE_PAYMENT",
                details: { paymentId: id },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        return res.status(200).json({
            success: true,
            message: "Available payment updated successfully",
        });
    } catch (error) {
        logger.error(`Error update available payment: ${(error as Error).message}`);
        next(error);
    }
};

export const deleteAvailablepayment = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { adminId } = req.admin!;

    try {
        await availablePaymentService.deleteAvailablepayment({ id, adminId });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "DELETE_AVAILABLE_PAYMENT",
                details: { paymentId: id },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        return res.status(200).json({
            success: true,
            message: "Available Payment successfully deleted",
        });
    } catch (error) {
        logger.error(`Error deleting available payment: ${(error as Error).message}`);
        next(error);
    }
};
