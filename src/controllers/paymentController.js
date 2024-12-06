import { verifySignature } from "../service/paylabs.js";
import * as paymentService from "../service/paymentService.js";
import logger from "../application/logger.js";
import { forwardCallback } from "../service/forwadCallback.js";

// Handle Paylabs callback notifications
export const paylabsCallback = async (req, res, next) => {
    try {
        // Extract and verify signature
        const { "x-signature": signature, "x-timestamp": timestamp } = req.headers;
        const { body: payload, method: httpMethod, originalUrl: endpointUrl } = req;

        if (!verifySignature(httpMethod, endpointUrl, payload, timestamp, signature)) {
            return res.status(401).send("Invalid signature");
        }

        const { responseHeaders, payloadResponse, currentDateTime, expiredDateTime, payloadResponseError } =
            await paymentService.callbackPaylabs({ payload });

        if (currentDateTime > expiredDateTime && expiredDateTime != null) {
            return res.status(200).json(payloadResponseError);
        }

        res.set(responseHeaders).status(200).json(payloadResponse);

        await forwardCallback({ payload });
    } catch (error) {
        logger.error(`Error handling webhook: ${error.message}`);
        next(error);
    }
};

export const paylabsVaStaticCallback = async (req, res, next) => {
    try {
        // Extract and verify signature
        const { "x-signature": signature, "x-timestamp": timestamp } = req.headers;
        const { body: payload, method: httpMethod, originalUrl: endpointUrl } = req;

        if (!verifySignature(httpMethod, endpointUrl, payload, timestamp, signature)) {
            return res.status(401).send("Invalid signature");
        }

        const { responseHeaders, responsePayload } = await paymentService.callbackPaylabsVaStatic({ payload });

        res.set(responseHeaders).status(200).json(responsePayload);

        await forwardCallback({ payload });
    } catch (error) {
        logger.error(`Error handling webhook: ${error.message}`);
        next(error);
    }
};
