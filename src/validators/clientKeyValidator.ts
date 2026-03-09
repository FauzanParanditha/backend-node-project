import joi from "joi";

export const clientKeySchema = joi.object({
    clientId: joi.string().max(100).required(),
    publicKey: joi.string().required(),
    active: joi.boolean().required(),
    adminId: joi.string().required(),
});
