import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { logActivity } from "../service/activityLogService.js";
import * as clientAvailablePaymentService from "../service/clientAvailablePaymentService.js";

export const getClientAvailablePayments = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { clientId } = req.query as Record<string, any>;
    const { userId } = req.user!;

    try {
        if (!clientId) {
            return res.status(400).json({ success: false, message: "clientId is required" });
        }

        const data = await clientAvailablePaymentService.getClientAvailablePayments({
            clientId,
            userId,
        });

        return res.status(200).json({
            success: true,
            message: "Client available payments",
            data,
        });
    } catch (error) {
        logger.error(`Error get client available payments: ${(error as Error).message}`);
        next(error);
    }
};

export const updateClientAvailablePayment = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { clientId, availablePaymentId, active } = req.body;
    const { userId } = req.user!;

    try {
        if (!clientId || !availablePaymentId || typeof active !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "clientId, availablePaymentId, and active are required",
            });
        }

        await clientAvailablePaymentService.updateClientAvailablePayment({
            clientId,
            userId,
            availablePaymentId,
            active,
        });

        logActivity({
            actorId: userId.toString(),
            role: "user",
            action: "TOGGLE_CLIENT_PAYMENT",
            details: { clientId, availablePaymentId, active },
            ipAddress: req.ip,
        }).catch(console.error);

        return res.status(200).json({
            success: true,
            message: "Client available payment updated",
        });
    } catch (error) {
        logger.error(`Error update client available payment: ${(error as Error).message}`);
        next(error);
    }
};
