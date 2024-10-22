import Joi from "joi";

export const validateCreateLinkRequest = (data) => {
  const schema = Joi.object({
    // merchantId: Joi.string().max(20).required(),
    // merchantTradeNo: Joi.string().max(32).required(),
    // requestId: Joi.string().max(64).required(),
    amount: Joi.number().precision(2).required(),
    phoneNumber: Joi.string().max(20).required(),
    productName: Joi.string().max(100).required(),
    notifyUrl: Joi.string().max(200).optional(),
    redirectUrl: Joi.string().max(200).required(),
    lang: Joi.string().max(10).optional(),
    payer: Joi.string().max(60).optional(),
    paymentType: Joi.string().max(20).optional(),
    feeType: Joi.string().valid("BEN", "OUR").optional(),
  });

  return schema.validate(data);
};
