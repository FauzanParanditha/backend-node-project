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
    // Expiry in MINUTES (unified across rails), 1..1440 (max 24h). QRIS converts
    // to seconds internally; VA SNAP builds an ISO-8601 expiredDate. Default when
    // omitted: QRIS 5 min, VA SNAP 1440 min. Ignored by dynamic VA (Paylabs
    // does not support VA expiry).
    expire: joi.number().min(1).max(1440).optional(),
    // VA SNAP only: lets the client choose the VA transaction type
    // (e.g. "C" close/single-use). Single char per Paylabs spec; ignored by
    // other rails. Omitted downstream when not provided (Paylabs uses default).
    virtualAccountTrxType: joi.string().max(1).optional(),
    paymentType: joi.string().required(),
})
    // Silently drop fields that are not part of the order payload. The merchant
    // dashboard / embedded iframe sometimes carries client-level config
    // (e.g. frameOrigins, requireSignedAck) into the create-order request;
    // those are read server-side from the Client record, never from the body,
    // so we ignore extras instead of rejecting the whole order. Required and
    // typed fields are still enforced.
    .prefs({ stripUnknown: true });

export const vaStaticSchema = joi
    .object({
        phoneNumber: joi
            .string()
            .pattern(/^\+?[0-9]+$/)
            .min(10)
            .max(15)
            .required(),
        paymentMethod: joi.string().required(),
        storeId: joi.string().optional(),
        paymentType: joi.string().required(),
    })
    // Drop client-level config (frameOrigins, requireSignedAck) the iframe may
    // carry into the request; those are read server-side from the Client.
    .prefs({ stripUnknown: true });

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
})
    // Drop client-level config (frameOrigins, requireSignedAck) the dashboard
    // may carry into the payment-link request; read server-side from the Client.
    .prefs({ stripUnknown: true });

export const paymentSNAPSchema = joi.object({
    customerNo: joi.string().required(),
});

export const refundSchema = joi
    .object({
        reason: joi.string().required(),
    })
    .prefs({ stripUnknown: true });

export const deleteSNAPSchema = joi.object({
    partnerServiceId: joi.string().required().max(8),
    customerNo: joi.string().required().max(20),
    virtualAccountNo: joi.string().required().max(28),
    trxId: joi.string().optional().max(64),
    additionalInfo: joi.object().optional(),
});
