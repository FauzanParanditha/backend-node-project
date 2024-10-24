import Joi from "joi";

const logSchema = Joi.object({
  method: Joi.string().required(),
  endpoint: Joi.string().required(),
  headers: Joi.object().required(),
  body: Joi.object(),
  ipAddress: Joi.string().required(),
});

export const validateLog = (log) => {
  return logSchema.validate(log);
};
