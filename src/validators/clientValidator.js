import joi from "joi";

export const clientSchema = joi.object({
    name: joi.string().max(100).required(),
    notifyUrl: joi.string().uri().required(),
    adminId: joi.string().required(),
});
