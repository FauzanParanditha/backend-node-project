import joi from "joi";

export const productValidationSchema = joi.object({
    title: joi.string().trim().required().messages({
        "any.required": "Title is required",
        "string.empty": "Title is required",
    }),
    price: joi.number().greater(1).required().messages({
        "number.base": "Price should be a number",
        "number.greater": "Price should be above $1",
        "any.required": "Price is required",
    }),
    discount: joi.number().min(0).required().messages({
        "number.base": "Discount should be a number",
        "number.min": "Discount must not be negative",
    }),
    stock: joi.number().greater(20).required().messages({
        "number.base": "Stock should be a number",
        "number.greater": "Stock must be above 20",
        "any.required": "Stock is required",
    }),
    colors: joi.array().items(joi.object()).optional(),
    sizes: joi.array().items(joi.object()).optional(),
    category: joi.string().trim().required().messages({
        "any.required": "Category is required",
        "string.empty": "Category is required",
    }),
    description: joi.string().trim().required().messages({
        "any.required": "Description is required",
        "string.empty": "Description is required",
    }),
    adminId: joi.string().required(),
});
