import joi from "joi";

export const registerSchema = joi.object({
    email: joi
        .string()
        .min(1)
        .max(64)
        .required()
        .email({
            tlds: { allow: true },
        }),
    fullName: joi.string().max(100).required(),
    password: joi.string().required().pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,}$")),
});

export const updateAdminSchema = joi.object({
    fullName: joi.string().max(100).required(),
});

export const updateUserSchema = joi.object({
    fullName: joi.string().max(100).required(),
});

export const loginSchema = joi.object({
    email: joi
        .string()
        .min(1)
        .max(64)
        .required()
        .email({
            tlds: { allow: true },
        }),
    password: joi.string().required().pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,}$")),
});

export const acceptCodeSchema = joi.object({
    email: joi
        .string()
        .min(1)
        .max(64)
        .required()
        .email({
            tlds: { allow: true },
        }),
    provided_code: joi.number().required(),
});

export const changePasswordSchema = joi.object({
    adminId: joi.string().optional(),
    userId: joi.string().optional(),
    verified: joi.boolean().optional(),
    new_password: joi.string().required().pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,}$")),
    old_password: joi.string().required().pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,}$")),
});

export const acceptFPCodeSchema = joi.object({
    email: joi
        .string()
        .min(1)
        .max(64)
        .required()
        .email({
            tlds: { allow: true },
        }),
    provided_code: joi.number().required(),
    new_password: joi.string().required().pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,}$")),
});
