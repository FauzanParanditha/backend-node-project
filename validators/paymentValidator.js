import joi from "joi";

export const validateCreateLinkRequest = (data) => {
  const schema = joi.object({
    requestId: joi.string().max(64).required(),
    merchantId: joi.string().max(20).required(),
    storeId: joi.string().max(30).optional(),
    merchantTradeNo: joi.string().max(32).required(),
    amount: joi.number().precision(2).required(),
    payer: joi.string().max(60).optional(),
    phoneNumber: joi.string().max(100).required(),
    productName: joi.string().max(100).required(),
    notifyUrl: joi.string().max(200).optional(),
    redirectUrl: joi.string().max(200).required(),
    lang: joi.string().max(10).optional(),
    paymentType: joi.string().max(20).optional(),
    feeType: joi.string().valid("BEN", "OUR").optional(),
  });

  return schema.validate(data);
};

export const validateQrisRequest = (data) => {
  const schema = joi.object({
    requestId: joi.string().max(64).required(),
    merchantId: joi.string().max(20).required(),
    storeId: joi.string().max(30).optional(),
    paymentType: joi.string().max(20).required(),
    amount: joi.number().precision(2).required(),
    merchantTradeNo: joi.string().max(32).required(),
    notifyUrl: joi.string().max(200).optional(),
    expire: joi.number().optional(),
    feeType: joi.string().valid("BEN", "OUR").optional(),
    productName: joi.string().max(100).required(),
    productInfo: joi
      .array()
      .items(
        joi.object({
          id: joi.string().max(10).required(),
          name: joi.string().max(32).required(),
          price: joi.number().required(),
          type: joi.string().max(20).required(),
          url: joi.string().max(200).optional(),
          quantity: joi.number().max(4).required(),
        })
      )
      .min(1)
      .optional(),
  });

  return schema.validate(data);
};

export const validateQrisStatus = (data) => {
  const schema = joi.object({
    requestId: joi.string().max(64).required(),
    merchantId: joi.string().max(10).required(),
    storeId: joi.string().max(30).optional(),
    merchantTradeNo: joi.string().max(32).optional(),
    rrn: joi.string().max(32).optional(),
    paymentType: joi.string().max(20).required(),
  });

  return schema.validate(data);
};

export const validateQrisStatusSchema = joi.object({
  merchantTradeNo: joi.string().max(32).required(),
});
