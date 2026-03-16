import type { NextFunction, Request, Response } from "express";
import logger from "../application/logger.js";
import Client from "../models/clientModel.js";
import { verifySignatureForward, verifySignatureMiddleware } from "../service/paylabs.js";

export const jwtMiddlewareVerify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            "x-partner-id": partnerId,
            "x-signature": signature,
            "x-timestamp": timestamp,
            "x-signer": signer,
        } = req.headers;
        const { body: payload, method: httpMethod, originalUrl: endpointUrl } = req;

        // Validate partner ID
        const allowedPartnerId = await Client.findOne({ clientId: { $eq: partnerId } }).select("+clientId");
        if (!allowedPartnerId) {
            res.status(401).send("Invalid partner ID");
            return;
        }
        if (signer === "frontend") {
            const isSignatureValid = verifySignatureForward(
                httpMethod,
                endpointUrl,
                payload,
                timestamp as string,
                signature as string,
            );

            if (!isSignatureValid) {
                res.status(401).send("Invalid signature");
                return;
            }
        } else {
            const isSignatureValid = await verifySignatureMiddleware(
                httpMethod,
                endpointUrl,
                payload,
                timestamp as string,
                signature as string,
                allowedPartnerId.clientId as string,
            );

            if (!isSignatureValid) {
                res.status(401).send("Invalid signature");
                return;
            }
        }

        (req as unknown as Record<string, unknown>).partnerId = allowedPartnerId;
        next();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Error jwtMiddleware: ${message}`);
        next(error);
    }
};
