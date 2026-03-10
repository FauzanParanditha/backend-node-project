import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { logActivity } from "../service/activityLogService.js";
import { getAdminActivityActor } from "../utils/activityActor.js";
import * as categoryService from "../service/categoryService.js";
import { categorySchema } from "../validators/categoryValidator.js";

export const categories = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const {
        query = "",
        limit = 10,
        page = 1,
        sort_by = "_id",
        sort = -1,
        countOnly = false,
    } = req.query as Record<string, any>;

    try {
        const category = await categoryService.getAllCategorys({
            query,
            limit,
            page,
            sort_by,
            sort,
            countOnly,
        });

        if (countOnly) {
            return res.status(200).json({ count: category.count });
        }

        return res.status(200).json({
            success: true,
            message: "All categories",
            data: category.categorys,
            pagination: category.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching categories: ${(error as Error).message}`);
        next(error);
    }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { name } = req.body;
    const { adminId } = req.admin!;

    try {
        const { error, value } = categorySchema.validate({
            name,
            adminId,
        });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        await categoryService.createCategory({ value });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "CREATE_CATEGORY",
                details: { categoryName: name },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        res.status(201).json({ success: true, message: "Category create successfully" });
    } catch (error) {
        logger.error(`Error create category: ${(error as Error).message}`);
        next(error);
    }
};

export const category = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;

    try {
        const category = await categoryService.category({ id });

        return res.status(200).json({
            success: true,
            message: "Category",
            data: category,
        });
    } catch (error) {
        logger.error(`Error fetching category: ${(error as Error).message}`);
        next(error);
    }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { name } = req.body;
    const { adminId } = req.admin!;

    try {
        const { error, value } = categorySchema.validate({ name, adminId });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        await categoryService.updateCategory({
            id,
            value,
        });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "UPDATE_CATEGORY",
                details: { targetCategoryId: id, newCategoryName: name },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        return res.status(200).json({
            success: true,
            message: "Successfully update category",
        });
    } catch (error) {
        logger.error(`Error update category: ${(error as Error).message}`);
        next(error);
    }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    const { adminId } = req.admin!;

    try {
        await categoryService.deleteCategory({ id, adminId });

        const actor = getAdminActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "DELETE_CATEGORY",
                details: { targetCategoryId: id },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        return res.status(200).json({
            success: true,
            message: "Successfully delete category",
        });
    } catch (error) {
        logger.error(`Error delete category: ${(error as Error).message}`);
        next(error);
    }
};
