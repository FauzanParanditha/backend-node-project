import joi from "joi";

export const clientSchema = joi.object({
    name: joi.string().max(100).required(),
    notifyUrl: joi.string().uri().required(),
    userId: joi.string().required(),
    active: joi.boolean().optional(),
    adminId: joi.string().required(),
});
