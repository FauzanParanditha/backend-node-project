export const jwtMiddlewareVerify = async (req, res, next) => {
    const clientIP = req.headers["x-forwarded-for"] || req.ip;

    try {
        const whitelistedIP = await IPWhitelist.findOne({ ipAddress: clientIP });
        if (!whitelistedIP) {
            return res.status(403).json({
                success: false,
                message: "Access forbidden: Your IP address is not whitelisted.",
            });
        }

        const { "x-partner-id": partnerId, "x-signature": signature, "x-timestamp": timestamp } = req.headers;
        const { body: payload, method: httpMethod, originalUrl: endpointUrl } = req;

        // Validate partner ID
        const allowedPartnerId = await Client.findOne({ clientId: { $eq: partnerId } }).select("+clientId");
        if (!allowedPartnerId) {
            return res.status(401).send("Invalid partner ID");
        }

        // 🛠 Tambahkan await di sini!
        const isSignatureValid = await verifySignatureMiddleware(
            httpMethod,
            endpointUrl,
            payload,
            timestamp,
            signature,
            allowedPartnerId.clientId,
        );

        if (!isSignatureValid) {
            return res.status(401).send("Invalid signature");
        }

        req.partnerId = allowedPartnerId;
        next();
    } catch (error) {
        logger.error(`Error jwtMiddleware: ${error.message}`);
        next(error);
    }
};
