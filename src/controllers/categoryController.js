import * as categoryService from "../service/categoryService.js";
import logger from "../application/logger.js";
import { categorySchema } from "../validators/categoryValidator.js";

export const categories = async (req, res, next) => {
    const { query = "", limit = 10, page = 1, sort_by = "_id", sort = -1, countOnly = false } = req.query;

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
        logger.error(`Error fetching categories: ${error.message}`);
        next(error);
    }
};

export const create = async (req, res, next) => {
    const { name } = req.body;
    const { adminId } = req.admin;

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

        const category = await categoryService.createCategory({ name, adminId });
        res.status(201).json({ success: true, message: "Category create successfully" });
    } catch (error) {
        logger.error(`Error create category: ${error.message}`);
        next(error);
    }
};

export const category = async (req, res, next) => {
    const { id } = req.params;

    try {
        const category = await categoryService.category({ id });

        return res.status(200).json({
            success: true,
            message: "Category",
            data: category,
        });
    } catch (error) {
        logger.error(`Error fetching category: ${error.message}`);
        next(error);
    }
};

export const updateCategory = async (req, res, next) => {
    const { id } = req.params;
    const { name } = req.body;
    const { adminId } = req.admin;

    try {
        const { error, value } = categorySchema.validate({ name, adminId });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        const category = await categoryService.updateCategory({
            id,
            adminId,
            name,
        });

        return res.status(200).json({
            success: true,
            message: "Successfully update category",
        });
    } catch (error) {
        logger.error(`Error update category: ${error.message}`);
        next(error);
    }
};

export const deleteCategory = async (req, res, next) => {
    const { id } = req.params;
    const { adminId } = req.admin;

    try {
        const category = await categoryService.deleteCategory({ id, adminId });
        return res.status(200).json({
            success: true,
            message: "Successfully delete category",
        });
    } catch (error) {
        logger.error(`Error delete category: ${error.message}`);
        next(error);
    }
};
