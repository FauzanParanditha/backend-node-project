import joi from "joi";

export const clientSchema = joi.object({
    name: joi.string().max(100).required(),
    notifyUrl: joi.string().uri().allow(null, "").optional(),
    userIds: joi.array().items(joi.string()).required(),
    active: joi.boolean().optional(),
    adminId: joi.string().required(),
    availablePaymentIds: joi.array().items(joi.string()).optional(),
});

export const clientUserUpdateSchema = joi.object({
    name: joi.string().max(100).required(),
    notifyUrl: joi.string().uri().allow(null, "").optional(),
    active: joi.boolean().optional(),
});
