import joi from "joi";

// Allowed iframe origins (scheme + host [+ port], no path) for the merchant's
// hosted payment page. Used to build a per-order CSP frame-ancestors.
//
// Accepts EITHER a JSON array of origins OR a single string with origins
// separated by newlines/commas (the dashboard textarea sends one origin per
// line). A string is coerced to a trimmed, de-duplicated, empty-filtered array
// before the per-item URI validation runs, so the API is robust to either
// client encoding.
const originItem = joi.string().uri({ scheme: ["http", "https"] }).max(255);

const frameOriginsSchema = joi
    .alternatives()
    .try(
        joi.array().items(originItem),
        joi
            .string()
            .allow("")
            .custom((val: string, helpers) => {
                const arr = [
                    ...new Set(
                        val
                            .split(/[\n,]/)
                            .map((s) => s.trim())
                            .filter(Boolean),
                    ),
                ];
                // Validate each split origin with the same URI rule as the
                // array branch; reject the whole field if any entry is invalid.
                for (const origin of arr) {
                    const { error } = originItem.validate(origin);
                    if (error) return helpers.error("any.invalid");
                }
                return arr;
            }),
    )
    .optional();

export const clientSchema = joi.object({
    name: joi.string().max(100).required(),
    notifyUrl: joi.string().uri().allow(null, "").optional(),
    frameOrigins: frameOriginsSchema,
    requireSignedAck: joi.boolean().optional(),
    userIds: joi.array().items(joi.string()).required(),
    active: joi.boolean().optional(),
    adminId: joi.string().required(),
    availablePaymentIds: joi.array().items(joi.string()).optional(),
});

export const clientUserUpdateSchema = joi.object({
    name: joi.string().max(100).required(),
    notifyUrl: joi.string().uri().allow(null, "").optional(),
    frameOrigins: frameOriginsSchema,
    requireSignedAck: joi.boolean().optional(),
    active: joi.boolean().optional(),
});
