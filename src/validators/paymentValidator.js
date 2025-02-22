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

export const validateCallback = (data) => {
    const schema = joi.object({
        requestId: joi.string().max(64).required(),
        errCode: joi.string().max(32).required(),
        errCodeDes: joi.string().max(128).optional(),
        merchantId: joi.string().max(20).required(),
        storeId: joi.string().max(30).optional(),
        paymentType: joi.string().max(20).required(),
        amount: joi.number().precision(2).required(),
        merchantTradeNo: joi.string().max(32).required(),
        platformTradeNo: joi.string().max(32).optional(),
        createTime: joi.string().max(16).optional(),
        successTime: joi.string().max(16).optional(),
        status: joi.string().max(32).optional(),
        productName: joi.string().max(100).optional(),
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
                }),
            )
            .min(1)
            .optional(),
        paymentMethodInfo: joi
            .object()
            .when("paymentType", [
                {
                    is: "QRIS",
                    then: joi.object({
                        nmid: joi.string().max(32).optional(),
                        rrn: joi.string().max(32).optional(),
                        tid: joi.string().max(32).optional(),
                        payer: joi.string().max(60).optional(),
                        phoneNumber: joi.string().max(20).optional(),
                        issuerId: joi.string().max(20).optional(),
                    }),
                },
                {
                    is: joi
                        .string()
                        .valid(
                            "SinarmasVA",
                            "MaybankVA",
                            "DanamonVA",
                            "BNCVA",
                            "BCAVA",
                            "INAVA",
                            "BNIVA",
                            "PermataVA",
                            "MuamalatVA",
                            "BSIVA",
                            "BRIVA",
                            "MandiriVA",
                            "CIMBVA",
                        ),
                    then: joi.object({
                        vaCode: joi.string().max(32).required(),
                    }),
                },
                {
                    is: joi.string().valid("Indomaret", "Alfamart", "POS"),
                    then: joi.object({
                        paymentCode: joi.string().max(32).required(),
                    }),
                },
            ])
            .optional(),
        transFeeRate: joi.number().precision(6).optional(),
        transFeeAmount: joi.number().precision(2).optional(),
        totalTransFee: joi.number().precision(2).optional(),
        vatFee: joi.number().precision(2).optional(),
        expiredTime: joi.string().max(16).when("status", { is: "06", then: joi.required() }),
        qrCode: joi.string().max(256).when("status", { is: "06", then: joi.required() }),
    });
    return schema.validate(data, { abortEarly: false });
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
                }),
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
                }),
            )
            .min(1)
            .optional(),
        feeType: joi.string().valid("BEN", "OUR").optional(),
    });
    return schema.validate(data);
};

export const validateVaStatus = (data) => {
    const schema = joi.object({
        requestId: joi.string().max(64).required(),
        merchantId: joi.string().max(10).required(),
        storeId: joi.string().max(30).optional(),
        merchantTradeNo: joi.string().max(32).optional(),
        paymentType: joi.string().max(20).required(),
    });

    return schema.validate(data);
};

export const validateStaticVA = (data) => {
    const schema = joi.object({
        requestId: joi.string().max(64).required(),
        merchantId: joi.string().max(20).required(),
        storeId: joi.string().max(30).optional(),
        paymentType: joi.string().max(20).required(),
        payer: joi.string().max(60).required(),
        beUsedFor: joi.string().max(100).optional(),
        notifyUrl: joi.string().max(200).optional(),
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
                billNo: joi.string().max(18).optional(),
                billName: joi.string().max(20).optional(),
                billShortName: joi.string().max(20).optional(),
                billDescription: joi
                    .object({
                        english: joi.string().max(18).optional(),
                        indonesia: joi.string().max(18).optional(),
                    })
                    .optional(),
                billSubCompany: joi.string().max(5).optional(),
                billAmount: joi
                    .object({
                        value: joi.string().max(16).required(),
                        currency: joi.string().max(3).required(),
                    })
                    .optional(),
                additionalInfo: joi.object().optional(),
            }),
        ),
        freeTexts: joi
            .array()
            .items(
                joi.object({
                    english: joi.string().max(18).optional(),
                    indonesia: joi.string().max(18).optional(),
                }),
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

export const validatedeleteVASNAP = (data) => {
    const schema = joi.object({
        partnerServiceId: joi.string().max(8).required(),
        customerNo: joi.string().max(20).required(),
        virtualAccountNo: joi.string().max(28).required(),
        trxId: joi.string().max(64).required(),
        additionalInfo: joi.object().optional(),
    });

    return schema.validate(data);
};

export const validateVaSNAPStatus = (data) => {
    const schema = joi.object({
        partnerServiceId: joi.string().max(8).required(),
        customerNo: joi.string().max(20).required(),
        virtualAccountNo: joi.string().max(28).required(),
        inquiryRequestId: joi.string().max(128).required(),
        paymentRequestId: joi.string().max(128).optional(),
        additionalInfo: joi.object().optional(),
    });

    return schema.validate(data);
};

export const validateSnapDelete = (data) => {
    const schema = joi.object({
        responseCode: joi.string().max(7).required(),
        responseMessage: joi.string().max(150).required(),
        virtualAccountData: joi
            .object({
                partnerServiceId: joi.string().max(8).required(),
                customerNo: joi.string().max(20).required(),
                virtualAccountNo: joi.string().max(28).required(),
                trxId: joi.string().max(64).optional(),
                additionalInfo: joi.object().optional(),
            })
            .required(),
    });
    return schema.validate(data);
};

export const validatePaymentVASNAP = (data) => {
    const schema = joi.object({
        partnerServiceId: joi.string().max(8).required(),
        customerNo: joi.string().max(20).required(),
        virtualAccountNo: joi.string().max(28).required(),
        virtualAccountName: joi.string().max(255).optional(),
        virtualAccountEmail: joi.string().max(255).optional(),
        virtualAccountPhone: joi.string().max(30).optional(),
        trxId: joi.string().max(64).required(),
        paymentRequestId: joi.string().max(128).required(),
        channelCode: joi.number().optional(),
        hashedSourceAccountNo: joi.string().max(32).optional(),
        sourceBankCode: joi.string().max(3).optional(),
        paidAmount: joi
            .object({
                value: joi.string().max(16).required(),
                currency: joi.string().max(3).required(),
            })
            .required(),
        cumulativePaymentAmount: joi
            .object({
                value: joi.string().max(16).required(),
                currency: joi.string().max(3).required(),
            })
            .optional(),
        paidBills: joi.string().max(6).optional(),
        totalAmount: joi
            .object({
                value: joi.string().max(16).required(),
                currency: joi.string().max(3).required(),
            })
            .optional(),
        trxDateTime: joi.date().optional(),
        referenceNo: joi.string().max(64).optional(),
        journalNum: joi.string().max(6).optional(),
        paymentType: joi.string().max(1).optional(),
        flagAdvise: joi.string().max(1).optional(),
        subCompany: joi.string().max(5).optional(),
        billDetails: joi
            .array()
            .items(
                joi.object({
                    billCode: joi.string().max(2).optional(),
                    billNo: joi.string().max(18).optional(),
                    billName: joi.string().max(20).optional(),
                    billShortName: joi.string().max(20).optional(),
                    billDescription: joi
                        .object({
                            english: joi.string().max(18).optional(),
                            indonesia: joi.string().max(18).optional(),
                        })
                        .optional(),
                    billSubCompany: joi.string().max(5).optional(),
                    billAmount: joi
                        .object({
                            value: joi.string().max(16).required(),
                            currency: joi.string().max(3).required(),
                        })
                        .optional(),
                    additionalInfo: joi.object().optional(),
                }),
            )
            .optional(),
        freeTexts: joi
            .array()
            .items(
                joi.object({
                    english: joi.string().max(18).optional(),
                    indonesia: joi.string().max(18).optional(),
                }),
            )
            .optional(),
        additionalInfo: joi
            .object({
                transFeeRate: joi.number().precision(6).optional(),
                transFeeAmount: joi.number().precision(2).optional(),
                totalTransFee: joi.number().precision(2).optional(),
                vatFee: joi.number().precision(2).optional(),
                paymentType: joi.string().max(20).optional(),
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
                }),
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

export const validateEMoneyRequest = (data) => {
    const schema = joi.object({
        requestId: joi.string().max(64).required(),
        merchantId: joi.string().max(20).required(),
        storeId: joi.string().max(30).optional(),
        paymentType: joi.string().max(20).required(),
        amount: joi.number().precision(2).required(),
        feeType: joi.string().valid("BEN", "OUR").optional(),
        merchantTradeNo: joi.string().max(32).required(),
        notifyUrl: joi.string().max(200).optional(),
        paymentParams: joi
            .object({
                redirectUrl: joi.string().max(200).required(),
                phoneNumber: joi
                    .string()
                    .pattern(/^\+?[0-9]+$/)
                    .min(10)
                    .max(15)
                    .optional(),
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
                }),
            )
            .min(1)
            .optional(),
    });

    return schema.validate(data);
};

export const validateEmoneyStatus = (data) => {
    const schema = joi.object({
        requestId: joi.string().max(64).required(),
        merchantId: joi.string().max(10).required(),
        storeId: joi.string().max(30).optional(),
        merchantTradeNo: joi.string().max(32).optional(),
        paymentType: joi.string().max(20).required(),
    });

    return schema.validate(data);
};

export const validateEMoneyRefund = (data) => {
    const schema = joi.object({
        requestId: joi.string().max(64).required(),
        merchantId: joi.string().max(20).required(),
        storeId: joi.string().max(30).optional(),
        merchantTradeNo: joi.string().max(32).required(),
        paymentType: joi.string().max(20).required(),
        amount: joi.number().precision(2).required(),
        refundAmount: joi.number().precision(2).required(),
        platformRefundNo: joi.string().max(32).required(),
        merchantRefundNo: joi.string().max(32).required(),
        notifyUrl: joi.string().max(200).optional(),
        reason: joi.string().max(200).optional(),
        transFeeRate: joi.number().precision(6).optional(),
        transFeeAmount: joi.number().precision(2).optional(),
        totalTransFee: joi.number().precision(2).optional(),
        vatFee: joi.number().precision(2).optional(),
    });

    return schema.validate(data);
};
