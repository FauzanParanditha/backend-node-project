import logger from "../application/logger.js";
import { forwardCallback } from "../service/forwadCallback.js";
import { verifySignature } from "../service/paylabs.js";
import * as paymentService from "../service/paymentService.js";
import { logCallback } from "../utils/logCallback.js";

// Handle Paylabs callback notifications
export const paylabsCallback = async (req, res, next) => {
    try {
        const {
            "x-partner-id": partnerId,
            "x-signature": signature,
            "x-timestamp": timestamp,
            "x-request-id": requestId,
        } = req.headers;
        const { method: httpMethod, originalUrl: endpointUrl } = req;

        if (partnerId !== process.env.PAYLABS_MERCHANT_ID) {
            return res.status(401).send("Invalid partner ID");
        }

        const payloadRaw = req.body.toString("utf8").trim();
        logger.info(`Raw Payload: ${payloadRaw}`);
        const payload = JSON.parse(payloadRaw);

        if (!verifySignature(httpMethod, endpointUrl, payloadRaw, timestamp, signature)) {
            // logger.error(`Signature verification failed: partnerId=${partnerId}, payload=${payloadRaw}`);
            return res.status(401).send("Invalid signature");
        }

        const { responseHeaders, payloadResponse, currentDateTime, expiredDateTime, payloadResponseError } =
            await paymentService.callbackPaylabs({ payload });

        if (expiredDateTime && currentDateTime > expiredDateTime) {
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

        res.set(responseHeaders).status(200).json(payloadResponse);

        forwardCallback({ payload }).catch(async (err) => {
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
    } catch (error) {
        logger.error(
            `Error handling webhook paylabs: ${error.message}, rawBody: ${
                req.body instanceof Buffer ? req.body.toString("utf8") : req.body
            }`,
        );
        await logCallback({
            type: "incoming",
            source: "paylabs",
            target: "internal",
            status: "error",
            payload: req.body instanceof Buffer ? req.body.toString("utf8") : req.body,
            errorMessage: error.message,
            requestId,
        });
        next(error);
    }
};

export const paylabsVaStaticCallback = async (req, res, next) => {
    try {
        const {
            "x-partner-id": partnerId,
            "x-signature": signature,
            "x-timestamp": timestamp,
            "x-request-id": requestId,
        } = req.headers;
        const { method: httpMethod, originalUrl: endpointUrl } = req;

        const allowedPartnerId = process.env.PAYLABS_MERCHANT_ID;
        if (partnerId !== allowedPartnerId) {
            return res.status(401).send("Invalid partner ID");
        }

        const payloadRaw = req.body.toString("utf8").trim();
        logger.info(`Raw Payload: ${payloadRaw}`);
        const payload = JSON.parse(payloadRaw);

        if (!verifySignature(httpMethod, endpointUrl, payloadRaw, timestamp, signature)) {
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

        res.set(responseHeaders).status(200).json(responsePayload);

        forwardCallback({ payload }).catch(async (err) => {
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
    } catch (error) {
        logger.error(`Error handling webhook va static: ${error.message}`);
        await logCallback({
            type: "incoming",
            source: "paylabs",
            target: "internal",
            status: "error",
            payload: req.body instanceof Buffer ? req.body.toString("utf8") : req.body,
            errorMessage: error.message,
            requestId,
        });
        next(error);
    }
};
