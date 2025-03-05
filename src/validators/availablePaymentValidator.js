import joi from "joi";

export const availablePaymentValidationSchema = joi.object({
    name: joi.string().required().messages({
        "string.base": "Name must be a string.",
        "any.required": "Name is required.",
    }),
    active: joi.boolean().required().messages({
        "boolean.base": "Active must be a boolean.",
        "any.required": "Active is required.",
    }),
    category: joi.string().required().messages({
        "string.base": "Category must be a string.",
        "any.required": "Category is required.",
    }),
    adminId: joi.string().required().messages({
        "string.base": "adminId must be a string.",
        "any.required": "adminId is required.",
    }),
});
