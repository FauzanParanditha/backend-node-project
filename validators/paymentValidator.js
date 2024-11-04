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

export const cancelQrisValidator = (data) => {
  const schema = joi.object({
    requestId: joi.string().max(64).required(),
    merchantId: joi.string().max(10).required(),
    storeId: joi.string().max(30).optional(),
    merchantTradeNo: joi.string().max(32).required(),
    platformTradeNo: joi.string().max(32).required(),
    qrCode: joi.string().max(300).optional(),
  });

  return schema.validate(data);
};

export const validateGenerateVA = (data) => {
  const schema = joi.object({
    requestId: joi.string().max(64).required(),
    merchantId: joi.string().max(20).required(),
    storeId: joi.string().max(30).optional(),
    paymentType: joi.string().max(20).required(),
    amount: joi.number().precision(2).required(),
    merchantTradeNo: joi.string().max(32).required(),
    notifyUrl: joi.string().max(200).optional(),
    payer: joi.string().max(60).required(),
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

export const validateCreateVASNAP = (data) => {
  const schema = joi.object({
    partnerServiceId: joi.string().max(8).required(),
    customerNo: joi.string().max(20).required(),
    virtualAccountNo: joi.string().max(28).required(),
    virtualAccountName: joi.string().max(255).optional(),
    virtualAccountEmail: joi.string().max(255).optional(),
    virtualAccountPhone: joi.string().max(30).optional(),
    trxId: joi.string().max(64).required(),
    totalAmount: joi.object({
      value: joi.string().max(16).required(),
      currency: joi.string().max(3).required(),
    }),
    billDetails: joi.array().items(
      joi.object({
        billCode: joi.string().max(2).optional(),
        billName: joi.string().max(20).optional(),
        billShortName: joi.string().max(20).optional(),
        billDescription: joi
          .object({
            english: joi.string().max(18).optional(),
            indonesia: joi.string().max(18).optional(),
          })
          .optional(),
        billShortName: joi.string().max(5).optional(),
        billAmount: joi
          .object({
            value: joi.string().max(16).required(),
            currency: joi.string().max(3).required(),
          })
          .optional(),
        additionalInfo: joi.object().optional(),
      })
    ),
    freeTexts: joi
      .array()
      .items(
        joi.object({
          english: joi.string().max(18).optional(),
          indonesia: joi.string().max(18).optional(),
        })
      )
      .optional(),
    virtualAccountTrxType: joi.string().max(1).optional(),
    feeAmount: joi
      .object({
        value: joi.string().max(16).required(),
        currency: joi.string().max(3).required(),
      })
      .optional(),
    expiredDate: joi.string().max(25).optional(),
    additionalInfo: joi
      .object({
        paymentType: joi.string().max(32).required(),
      })
      .optional(),
  });

  return schema.validate(data);
};

export const validateCreditCardRequest = (data) => {
  const schema = joi.object({
    requestId: joi.string().max(64).required(),
    merchantId: joi.string().max(20).required(),
    storeId: joi.string().max(30).optional(),
    paymentType: joi.string().max(20).required(),
    amount: joi.number().precision(2).required(),
    merchantTradeNo: joi.string().max(32).required(),
    notifyUrl: joi.string().max(200).optional(),
    paymentParams: joi
      .object({
        redirectUrl: joi.string().max(200).required(),
      })
      .optional(),
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
    feeType: joi.string().valid("BEN", "OUR").optional(),
  });

  return schema.validate(data);
};

export const validateCCStatus = (data) => {
  const schema = joi.object({
    requestId: joi.string().max(64).required(),
    merchantId: joi.string().max(10).required(),
    storeId: joi.string().max(30).optional(),
    merchantTradeNo: joi.string().max(32).optional(),
    paymentType: joi.string().max(20).required(),
  });

  return schema.validate(data);
};
