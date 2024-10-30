import joi from "joi";

export const validateCreateLinkRequest = (data) => {
  const schema = joi.object({
    merchantId: joi.string().max(20).required(),
    merchantTradeNo: joi.string().max(32).required(),
    requestId: joi.string().max(64).required(),
    amount: joi.number().precision(2).required(),
    phoneNumber: joi.string().max(20).required(),
    productName: joi.string().max(100).required(),
    storeId: joi.string().optional(),
    notifyUrl: joi.string().max(200).optional(),
    redirectUrl: joi.string().max(200).required(),
    lang: joi.string().max(10).optional(),
    payer: joi.string().max(60).optional(),
    paymentType: joi.string().max(20).optional(),
    feeType: joi.string().valid("BEN", "OUR").optional(),
  });

  return schema.validate(data);
};
