import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { forwardCallback } from "../service/forwadCallback.js";
import * as qrisService from "../service/qrisService.js";
import { logCallback } from "../utils/logCallback.js";
import { orderSchema } from "../validators/orderValidator.js";

export const createQris = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const partnerId = req.partnerId;
    try {
        // Validate request payload
        const validatedProduct = await orderSchema.validateAsync(req.body, {
            abortEarly: false,
        });
        const { response, result } = await qrisService.createQris({
            validatedProduct,
            partnerId: partnerId!,
        });
        // Respond with created order details
        res.status(200).json({
            success: true,
            qrCode: response.data.qrCode,
            qrUrl: response.data.qrisUrl,
            paymentExpired: response.data.expiredTime,
            paymentId: response.data.merchantTradeNo,
            totalAmount: response.data.amount,
            storeId: response.data.storeId,
            totalTransFee: response.data.totalTransFee,
            orderId: result.orderId,
            id: result._id,
        });
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error creating qris: ${(error as Error).message}`);
        next(error);
    }
};

export const qrisOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    try {
        const { responseHeaders, response } = await qrisService.qrisOrderStatus({
            id,
        });

        // Respond
        res.set(responseHeaders as Record<string, string>)
            .status(200)
            .json(response.data);
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error fetching qris status: ${(error as Error).message}`);
        next(error);
    }
};

export const cancleQris = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;
    try {
        const { currentDateTime, expiredDateTime, payloadResponseError, responseHeaders, response } =
            await qrisService.cancelQris({ id });

        if (currentDateTime! > expiredDateTime! && expiredDateTime != null) {
            return res.status(200).json(payloadResponseError);
        }

        await logCallback({
            type: "incoming",
            source: "paylabs",
            target: "internal",
            status: "success",
            payload: response!.data,
            response: response!.data,
            // requestId,
        });

        // Respond with update order details
        res.set(responseHeaders as Record<string, string>)
            .status(200)
            .json(response!.data);

        const payload = response!.data;
        forwardCallback({ payload }).catch(async (err: Error) => {
            logger.error(err.message);
            await logCallback({
                type: "forward",
                source: "internal",
                target: "client",
                status: "failed",
                payload,
                errorMessage: err.message,
                // requestId,
            });
        });
    } catch (error) {
        // Handle unexpected errors
        logger.error(`Error cancel qris: ${(error as Error).message}`);
        await logCallback({
            type: "incoming",
            source: "paylabs",
            target: "internal",
            status: "error",
            payload: req.body instanceof Buffer ? req.body.toString("utf8") : req.body,
            errorMessage: (error as Error).message,
            // requestId,
        });
        next(error);
    }
};
