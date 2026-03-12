import joi from "joi";
import { ALL_PERMISSIONS } from "../constants/permissions.js";

export const createRoleSchema = joi.object({
    name: joi.string().trim().min(1).max(50).required().messages({
        "string.empty": "Role name is required",
        "string.max": "Role name must have at most 50 characters",
    }),
    description: joi.string().trim().max(255).optional().allow(""),
    permissions: joi
        .array()
        .items(
            joi.string().valid(...ALL_PERMISSIONS),
        )
        .min(1)
        .required()
        .messages({
            "array.min": "At least one permission is required",
            "any.only": "One or more permissions are invalid",
        }),
});

export const updateRoleSchema = joi.object({
    name: joi.string().trim().min(1).max(50).optional().messages({
        "string.max": "Role name must have at most 50 characters",
    }),
    description: joi.string().trim().max(255).optional().allow(""),
    permissions: joi
        .array()
        .items(
            joi.string().valid(...ALL_PERMISSIONS),
        )
        .min(1)
        .optional()
        .messages({
            "array.min": "At least one permission is required",
            "any.only": "One or more permissions are invalid",
        }),
});
