import logger from "../application/logger.js";
import * as clientAvailablePaymentService from "../service/clientAvailablePaymentService.js";

export const getClientAvailablePayments = async (req, res, next) => {
    const { clientId } = req.query;
    const { userId } = req.user;

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
        logger.error(`Error get client available payments: ${error.message}`);
        next(error);
    }
};

export const updateClientAvailablePayment = async (req, res, next) => {
    const { clientId, availablePaymentId, active } = req.body;
    const { userId } = req.user;

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

        return res.status(200).json({
            success: true,
            message: "Client available payment updated",
        });
    } catch (error) {
        logger.error(`Error update client available payment: ${error.message}`);
        next(error);
    }
};
