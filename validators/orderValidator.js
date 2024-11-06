import joi from "joi";

export const orderSchema = joi.object({
  products: joi
    .array()
    .items(
      joi.object({
        productId: joi.string().required(),
        title: joi.string().required(),
        price: joi.number().required(),
        discount: joi.number().min(0).max(100).required(),
        quantity: joi.number().min(1).required(),
        colors: joi.array().items(joi.string().required()).min(1).optional(),
        sizes: joi.array().items(joi.string().required()).min(1).optional(),
      })
    )
    .min(1)
    .required(),

  userId: joi.string().required(),
  phoneNumber: joi
    .string()
    .pattern(/^[0-9]+$/)
    .min(10)
    .max(15)
    .required(),
  paymentMethod: joi.string().required(),
  storeId: joi.string().optional(),
  paymentType: joi.string().required(),
});

export const vaStaticSchema = joi.object({
  userId: joi.string().required(),
  phoneNumber: joi
    .string()
    .pattern(/^[0-9]+$/)
    .min(10)
    .max(15)
    .required(),
  paymentMethod: joi.string().required(),
  storeId: joi.string().optional(),
  paymentType: joi.string().required(),
});

export const orderLinkSchema = joi.object({
  products: joi
    .array()
    .items(
      joi.object({
        productId: joi.string().required(),
        title: joi.string().required(),
        price: joi.number().required(),
        discount: joi.number().min(0).max(100).required(),
        quantity: joi.number().min(1).required(),
        colors: joi.array().items(joi.string().required()).min(1).optional(),
        sizes: joi.array().items(joi.string().required()).min(1).optional(),
      })
    )
    .min(1)
    .required(),

  userId: joi.string().required(),
  phoneNumber: joi
    .string()
    .pattern(/^[0-9]+$/)
    .min(10)
    .max(15)
    .required(),
  paymentMethod: joi.string().required(),
  storeId: joi.string().optional(),
  paymentType: joi.string().optional(),
});

export const paymentSNAPSchema = joi.object({
  customerNo: joi.string().required(),
});

export const refundSchema = joi.object({
  reason: joi.string().required(),
});
