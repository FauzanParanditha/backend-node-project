import logger from "../application/logger.js";
import * as userService from "../service/userService.js";
import { registerSchema, updateUserSchema } from "../validators/authValidator.js";

export const getAllUser = async (req, res, next) => {
    const { query = "", limit = 10, page = 1, sort_by = "_id", sort = -1, countOnly = false } = req.query;

    try {
        const result = await userService.getAllUsers({
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
            message: "All users",
            data: result.users,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching users: ${error.message}`);
        next(error);
    }
};

export const register = async (req, res, next) => {
    const { email, password, fullName } = req.body;
    const { adminId } = req.admin;

    try {
        const { error } = registerSchema.validate({ email, password, fullName });
        if (error) return res.status(400).json({ success: false, message: error.details[0].message });

        await userService.registerUser({
            email,
            password,
            fullName,
            adminId,
        });
        res.status(201).json({ success: true, message: "Registered successfully" });
    } catch (error) {
        logger.error(`Error register: ${error.message}`);
        next(error);
    }
};

export const user = async (req, res, next) => {
    const { id } = req.params;

    try {
        const user = await userService.user({ id });

        return res.status(200).json({
            success: true,
            message: "user",
            data: user,
        });
    } catch (error) {
        logger.error(`Error fetching user: ${error.message}`);
        next(error);
    }
};

export const updateUser = async (req, res, next) => {
    const { id } = req.params;
    const { fullName } = req.body;
    const { adminId } = req.admin;

    try {
        const { error, value } = updateUserSchema.validate({ fullName });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        await userService.updateUser({
            id,
            value,
            adminId,
        });

        return res.status(200).json({
            success: true,
            message: "Successfully update user",
        });
    } catch (error) {
        logger.error(`Error update user address: ${error.message}`);
        next(error);
    }
};

export const deleteUser = async (req, res, next) => {
    const { id } = req.params;
    const { adminId } = req.admin;

    try {
        await userService.deleteUserById(id, adminId);
        return res.status(200).json({
            success: true,
            message: "Successfully deleted user",
        });
    } catch (error) {
        logger.error(`Error deleting user: ${error.message}`);
        next(error);
    }
};
