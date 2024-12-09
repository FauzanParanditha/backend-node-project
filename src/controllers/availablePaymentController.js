import logger from "../application/logger.js";
import * as availablePaymentService from "../service/availablePaymentService.js";
import { availablePaymentValidationSchema } from "../validators/availablePaymentValidator.js";

export const availablePayments = async (req, res, next) => {
    const { query = "", limit = 10, page = 1, sort_by = "_id", sort = -1, countOnly = false } = req.query;

    try {
        const result = await availablePaymentService.getAllAvailablePayment({
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
            message: "All available payment",
            data: result.availablePayment,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching available payment: ${error.message}`);
        next(error);
    }
};

export const createAvailablePayment = async (req, res, next) => {
    const { adminId } = req.admin;

    try {
        const { error } = availablePaymentValidationSchema.validate({ ...req.body, adminId }, { abortEarly: false });

        if (error) {
            return res.status(400).json({
                success: false,
                errors: error.details.map((err) => err.message),
            });
        }

        const availablePayment = await availablePaymentService.createAvailablePayment({ req, adminId });

        return res.status(201).json({
            success: true,
            message: "Successfully create available payment",
        });
    } catch (error) {
        logger.error(`Error create available payment: ${error.message}`);
        next(error);
    }
};

export const availablePayment = async (req, res, next) => {
    const { id } = req.params;

    try {
        const product = await availablePaymentService.availablePayment({ id });
        return res.status(200).json({
            success: true,
            message: "Available Payment",
            data: product,
        });
    } catch (error) {
        logger.error(`Error fetching available payment: ${error.message}`);
        next(error);
    }
};

export const updateAvailablePayment = async (req, res, next) => {
    const { id } = req.params;
    const { adminId } = req.admin;

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

        const availablePayment = await availablePaymentService.updateAvailablePayment({
            id,
            adminId,
            value,
            req,
        });

        return res.status(200).json({
            success: true,
            message: "Available payment updated successfully",
        });
    } catch (error) {
        logger.error(`Error update available payment: ${error.message}`);
        next(error);
    }
};

export const deleteAvailablepayment = async (req, res, next) => {
    const { id } = req.params;
    const { adminId } = req.admin;

    try {
        const availablePayment = await availablePaymentService.deleteAvailablepayment({ id, adminId });

        return res.status(200).json({
            success: true,
            message: "Available Payment successfully deleted",
        });
    } catch (error) {
        logger.error(`Error deleting available payment: ${error.message}`);
        next(error);
    }
};
