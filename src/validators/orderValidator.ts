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
                domain: joi.string().max(64).optional(),
            }),
        )
        .min(1)
        .required(),
    totalAmount: joi.string().required(),
    phoneNumber: joi
        .string()
        .pattern(/^\+?[0-9]+$/)
        .min(10)
        .max(15)
        .required(),
    paymentMethod: joi.string().required(),
    storeId: joi.string().optional(),
    expire: joi.number().min(1).max(1440).optional(),
    paymentType: joi.string().required(),
});

export const vaStaticSchema = joi.object({
    phoneNumber: joi
        .string()
        .pattern(/^\+?[0-9]+$/)
        .min(10)
        .max(15)
        .required(),
    paymentMethod: joi.string().required(),
    storeId: joi.string().optional(),
    paymentType: joi.string().required(),
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
                domain: joi.string().max(64).optional(),
            }),
        )
        .min(1)
        .required(),
    totalAmount: joi.string().required(),
    phoneNumber: joi
        .string()
        .pattern(/^\+?[0-9]+$/)
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

export const deleteSNAPSchema = joi.object({
    partnerServiceId: joi.string().required().max(8),
    customerNo: joi.string().required().max(20),
    virtualAccountNo: joi.string().required().max(28),
    trxId: joi.string().optional().max(64),
    additionalInfo: joi.object().optional(),
});
