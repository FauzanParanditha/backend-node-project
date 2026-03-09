import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { logActivity } from "../service/activityLogService.js";
import * as productService from "../service/productService.js";
import { productValidationSchema } from "../validators/productValidator.js";

export const products = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const {
        query = "",
        limit = 10,
        page = 1,
        sort_by = "_id",
        sort = -1,
        countOnly = false,
    } = req.query as Record<string, any>;

    try {
        const product = await productService.getAllProducts({
            query,
            limit,
            page,
            sort_by,
            sort,
            countOnly,
        });

        if (countOnly) {
            return res.status(200).json({ count: product.count });
        }

        return res.status(200).json({
            success: true,
            message: "all products",
            data: product.products,
            pagination: product.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching products: ${(error as Error).message}`);
        next(error);
    }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const parsedColors = JSON.parse(req.body.colors);
    const parsedSizes = JSON.parse(req.body.sizes);
    const { adminId } = req.admin!;

    try {
        const { error } = productValidationSchema.validate(
            { ...req.body, colors: parsedColors, sizes: parsedSizes, adminId },
            { abortEarly: false },
        );

        if (error) {
            return res.status(400).json({
                success: false,
                errors: error.details.map((err) => err.message),
            });
        }

        await productService.createProduct({ req, adminId });

        const reqBodyTitle = req.body.title || "Unknown Product";
        logActivity({
            actorId: adminId.toString(),
            role: "admin",
            action: "CREATE_PRODUCT",
            details: { productTitle: reqBodyTitle },
            ipAddress: req.ip,
        }).catch(console.error);

        return res.status(201).json({
            success: true,
            message: "Successfully create product",
        });
    } catch (error) {
        logger.error(`Error create products: ${(error as Error).message}`);
        next(error);
    }
};

export const product = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;

    try {
        const product = await productService.product({ id });
        return res.status(200).json({
            success: true,
            message: "Product",
            data: product,
        });
    } catch (error) {
        logger.error(`Error fetching product: ${(error as Error).message}`);
        next(error);
    }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { adminId } = req.admin!;

    try {
        const parsedColors = JSON.parse(req.body.colors || "[]");
        const parsedSizes = JSON.parse(req.body.sizes || "[]");

        const { error, value } = productValidationSchema.validate(
            { ...req.body, colors: parsedColors, sizes: parsedSizes, adminId },
            { abortEarly: false },
        );

        if (error) {
            return res.status(400).json({
                success: false,
                errors: error.details.map((err) => err.message),
            });
        }

        await productService.updateProduct({
            id,
            adminId,
            value,
            req,
        });

        const reqBodyTitleUpdate = req.body.title || undefined;
        logActivity({
            actorId: adminId.toString(),
            role: "admin",
            action: "UPDATE_PRODUCT",
            details: { targetProductId: id, updatedTitle: reqBodyTitleUpdate },
            ipAddress: req.ip,
        }).catch(console.error);

        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
        });
    } catch (error) {
        logger.error(`Error update product: ${(error as Error).message}`);
        next(error);
    }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { adminId } = req.admin!;

    try {
        await productService.deleteProduct({ id, adminId });

        logActivity({
            actorId: adminId.toString(),
            role: "admin",
            action: "DELETE_PRODUCT",
            details: { targetProductId: id },
            ipAddress: req.ip,
        }).catch(console.error);

        return res.status(200).json({
            success: true,
            message: "Product successfully deleted",
        });
    } catch (error) {
        logger.error(`Error deleting product: ${(error as Error).message}`);
        next(error);
    }
};
