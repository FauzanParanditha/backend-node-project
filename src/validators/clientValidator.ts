import joi from "joi";

// Allowed iframe origins (scheme + host [+ port], no path) for the merchant's
// hosted payment page. Used to build a per-order CSP frame-ancestors.
const frameOriginsSchema = joi
    .array()
    .items(joi.string().uri({ scheme: ["http", "https"] }).max(255))
    .optional();

export const clientSchema = joi.object({
    name: joi.string().max(100).required(),
    notifyUrl: joi.string().uri().allow(null, "").optional(),
    frameOrigins: frameOriginsSchema,
    userIds: joi.array().items(joi.string()).required(),
    active: joi.boolean().optional(),
    adminId: joi.string().required(),
    availablePaymentIds: joi.array().items(joi.string()).optional(),
});

export const clientUserUpdateSchema = joi.object({
    name: joi.string().max(100).required(),
    notifyUrl: joi.string().uri().allow(null, "").optional(),
    frameOrigins: frameOriginsSchema,
    active: joi.boolean().optional(),
});
