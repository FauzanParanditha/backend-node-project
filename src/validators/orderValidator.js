import joi from "joi";

export const orderSchema = joi.object({
    items: joi
        .array()
        .items(
            joi.object({
                id: joi.string().required(),
                price: joi.string().required(),
                quantity: joi.number().min(1).required(),
                name: joi.string().required().max(32),
                type: joi.string().required().max(20),
            }),
        )
        .min(1)
        .required(),
    totalAmount: joi.string().required(),
    payer: joi.string().max(255).min(3).required(),
    phoneNumber: joi
        .string()
        .pattern(/^[0-9]+$/)
        .min(10)
        .max(15)
        .required(),
    paymentMethod: joi.string().required(),
    storeId: joi.string().optional(),
    paymentType: joi.string().required(),
    forwardUrl: joi.string().uri().required(),
});

export const vaStaticSchema = joi.object({
    payer: joi.string().max(255).min(3).required(),
    phoneNumber: joi
        .string()
        .pattern(/^[0-9]+$/)
        .min(10)
        .max(15)
        .required(),
    paymentMethod: joi.string().required(),
    storeId: joi.string().optional(),
    paymentType: joi.string().required(),
    forwardUrl: joi.string().uri().required(),
});

export const orderLinkSchema = joi.object({
    items: joi
        .array()
        .items(
            joi.object({
                id: joi.string().required(),
                price: joi.string().required(),
                quantity: joi.number().min(1).required(),
                name: joi.string().required().max(32),
                type: joi.string().required().max(20),
            }),
        )
        .min(1)
        .required(),
    totalAmount: joi.string().required(),
    payer: joi.string().max(255).min(3).required(),
    phoneNumber: joi
        .string()
        .pattern(/^[0-9]+$/)
        .min(10)
        .max(15)
        .required(),
    paymentMethod: joi.string().required(),
    storeId: joi.string().optional(),
    paymentType: joi.string().optional(),
    forwardUrl: joi.string().uri().required(),
});

export const paymentSNAPSchema = joi.object({
    customerNo: joi.string().required(),
});

export const refundSchema = joi.object({
    reason: joi.string().required(),
});
