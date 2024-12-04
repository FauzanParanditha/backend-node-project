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
});

export const orderLinkSchema = joi.object({
    products: joi
        .array()
        .items(
            joi.object({
                productId: joi.string().required(),
                quantity: joi.number().min(1).required(),
                colors: joi.array().items(joi.string().required()).min(1).optional(),
                sizes: joi.array().items(joi.string().required()).min(1).optional(),
            }),
        )
        .min(1)
        .required(),
    userId: joi.string().required(),
    phoneNumber: joi
        .string()
        .pattern(/^[0-9]+$/)
        .min(10)
        .max(15)
        .required(),
    paymentMethod: joi.string().required(),
    storeId: joi.string().optional(),
    paymentType: joi.string().optional(),
});

export const paymentSNAPSchema = joi.object({
    customerNo: joi.string().required(),
});

export const refundSchema = joi.object({
    reason: joi.string().required(),
});
