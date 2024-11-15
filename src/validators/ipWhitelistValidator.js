import joi from "joi";

export const ipWhitelistSchema = joi.object({
  ipAddress: joi
    .string()
    .ip({ version: ["ipv4", "ipv6"] })
    .required()
    .messages({
      "string.ip": "Please enter a valid IP address.",
      "any.required": "IP address is required.",
    }),
  adminId: joi.string().required(),
});
