import Joi from "joi";

export const ipWhitelistSchema = Joi.object({
  ipAddress: Joi.string()
    .ip({ version: ["ipv4", "ipv6"] })
    .required()
    .messages({
      "string.ip": "Please enter a valid IP address.",
      "any.required": "IP address is required.",
    }),
  adminId: Joi.string().required(),
});
