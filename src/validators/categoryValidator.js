import joi from "joi";

export const categorySchema = joi.object({
    name: joi.string().min(1).max(10).trim().required(),
    adminId: joi.string().required(),
});
