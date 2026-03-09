import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import { sendPaymentSuccessAlert, sendSecurityAlert } from "../service/discordService.js";
import { forwardCallback } from "../service/forwadCallback.js";
import { verifySignature } from "../service/paylabs.js";
import * as paymentService from "../service/paymentService.js";
import { logCallback } from "../utils/logCallback.js";

// Handle Paylabs callback notifications
export const paylabsCallback = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    let requestId: string | undefined;
    try {
        const {
            "x-partner-id": partnerId,
            "x-signature": signature,
            "x-timestamp": timestamp,
            "x-request-id": reqId,
        } = req.headers;
        requestId = reqId as string | undefined;
        const { method: httpMethod, originalUrl: endpointUrl } = req;

        if (partnerId !== process.env.PAYLABS_MERCHANT_ID) {
            return res.status(401).send("Invalid partner ID");
        }

        const payloadRaw = req.body.toString("utf8").trim();
        logger.info(`Raw Payload: ${payloadRaw}`);
        const payload = JSON.parse(payloadRaw);

        if (!verifySignature(httpMethod, endpointUrl, payloadRaw, timestamp as string, signature as string)) {
            sendSecurityAlert("Invalid Webhook Signature (Paylabs)", req.ip || "Unknown", payloadRaw).catch(
                console.error,
            );
            return res.status(401).send("Invalid signature");
        }

        const { responseHeaders, payloadResponse, currentDateTime, expiredDateTime, payloadResponseError } =
            await paymentService.callbackPaylabs({ payload });

        if (expiredDateTime && currentDateTime && currentDateTime > expiredDateTime) {
            return res.status(200).json(payloadResponseError);
        }

        await logCallback({
            type: "incoming",
            source: "paylabs",
            target: "internal",
            status: "success",
            payload,
            response: payloadResponse,
            requestId,
        });

        if (payload.status === "02" || payload.status === "00") {
            sendPaymentSuccessAlert(
                payload.merchantTradeNo || payload.requestId,
                payload.paymentType || "PAYLABS",
                payload.amount,
            ).catch(console.error);
        }

        res.set(responseHeaders as Record<string, string>)
            .status(200)
            .json(payloadResponse);

        forwardCallback({ payload }).catch(async (err: Error) => {
            logger.error(err.message);
            await logCallback({
                type: "forward",
                source: "internal",
                target: "client",
                status: "failed",
                payload,
                errorMessage: err.message,
                requestId,
            });
        });
    } catch (error: unknown) {
        logger.error(
            `Error handling webhook paylabs: ${(error as Error).message}, rawBody: ${
                req.body instanceof Buffer ? req.body.toString("utf8") : req.body
            }`,
        );
        await logCallback({
            type: "incoming",
            source: "paylabs",
            target: "internal",
            status: "error",
            payload: req.body instanceof Buffer ? req.body.toString("utf8") : req.body,
            errorMessage: (error as Error).message,
            requestId,
        });
        next(error);
    }
};

export const paylabsVaStaticCallback = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    let requestId: string | undefined;
    try {
        const {
            "x-partner-id": partnerId,
            "x-signature": signature,
            "x-timestamp": timestamp,
            "x-request-id": reqId,
        } = req.headers;
        requestId = reqId as string | undefined;
        const { method: httpMethod, originalUrl: endpointUrl } = req;

        const allowedPartnerId = process.env.PAYLABS_MERCHANT_ID;
        if (partnerId !== allowedPartnerId) {
            return res.status(401).send("Invalid partner ID");
        }

        const payloadRaw = req.body.toString("utf8").trim();
        logger.info(`Raw Payload: ${payloadRaw}`);
        const payload = JSON.parse(payloadRaw);

        if (!verifySignature(httpMethod, endpointUrl, payloadRaw, timestamp as string, signature as string)) {
            sendSecurityAlert("Invalid Webhook Signature VA (Paylabs)", req.ip || "Unknown", payloadRaw).catch(
                console.error,
            );
            return res.status(401).send("Invalid signature");
        }

        const { responseHeaders, responsePayload } = await paymentService.callbackPaylabsVaStatic({ payload });

        await logCallback({
            type: "incoming",
            source: "paylabs",
            target: "internal",
            status: "success",
            payload,
            response: responsePayload,
            requestId,
        });

        if (payload.status === "02" || payload.status === "00") {
            sendPaymentSuccessAlert(
                payload.merchantTradeNo || payload.requestId,
                payload.paymentType || "PAYLABS_VA",
                payload.amount,
            ).catch(console.error);
        }

        res.set(responseHeaders as Record<string, string>)
            .status(200)
            .json(responsePayload);

        forwardCallback({ payload }).catch(async (err: Error) => {
            logger.error(err.message);
            await logCallback({
                type: "forward",
                source: "internal",
                target: "client",
                status: "failed",
                payload,
                errorMessage: err.message,
                requestId,
            });
        });
    } catch (error: unknown) {
        logger.error(`Error handling webhook va static: ${(error as Error).message}`);
        await logCallback({
            type: "incoming",
            source: "paylabs",
            target: "internal",
            status: "error",
            payload: req.body instanceof Buffer ? req.body.toString("utf8") : req.body,
            errorMessage: (error as Error).message,
            requestId,
        });
        next(error);
    }
};
