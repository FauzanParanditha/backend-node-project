import IPWhitelist from "../models/ipWhitelistModel.js";
import logger from "../application/logger.js";
import Client from "../models/clientModel.js";
import { verifySignatureForward } from "../service/paylabs.js";

export const jwtMiddlewareVerify = async (req, res, next) => {
    const clientIP = req.ip;
    // console.log(clientIP);

    try {
        const whitelistedIP = await IPWhitelist.findOne({ ipAddress: clientIP });
        if (!whitelistedIP) {
            return res.status(403).json({
                success: false,
                message: "Access forbidden: Your IP address does not whitelisted.",
            });
        }

        const { "x-partner-id": partnerId, "x-signature": signature, "x-timestamp": timestamp } = req.headers;
        const { body: payload, method: httpMethod, originalUrl: endpointUrl } = req;

        // Validate partner ID
        const allowedPartnerId = await Client.findOne({ clientId: { $eq: partnerId } }).select("+clientId");
        if (!allowedPartnerId) {
            return res.status(401).send("Invalid partner ID");
        }

        // Verify the signature
        if (!verifySignatureForward(httpMethod, endpointUrl, payload, timestamp, signature)) {
            return res.status(401).send("Invalid signature");
        }
        req.partnerId = allowedPartnerId;
        next();
    } catch (error) {
        logger.error(`Error jwtMiddleware: ${error.message}`);
        next(error);
    }
};
