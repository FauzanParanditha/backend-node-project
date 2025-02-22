import joi from "joi";

const logSchema = joi.object({
    method: joi.string().required(),
    endpoint: joi.string().required(),
    headers: joi.object().required(),
    body: joi.alternatives().try(joi.object(), joi.string()),
    statusCode: joi.number().required(),
    ipAddress: joi.string().required(),
    response: joi.any().optional(),
});

export const validateLog = (log) => {
    return logSchema.validate(log);
};
