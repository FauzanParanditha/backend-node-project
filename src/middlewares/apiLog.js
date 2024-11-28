import ApiLog from "../models/apiLogModel.js";
import logger from "../application/logger.js";
import { validateLog } from "../validators/apiLogValidator.js";

const apiLogger = async (req, res, next) => {
    const logData = {
        method: req.method,
        endpoint: req.originalUrl,
        headers: req.headers,
        body: req.body,
        ipAddress: req.ip || req.connection.remoteAddress,
        statusCode: null,
        response: null,
    };

    const originalSend = res.send.bind(res);

    res.send = function (body) {
        logData.statusCode = res.statusCode;

        try {
            logData.response = JSON.parse(body);
        } catch (error) {
            logData.response = body;
        }

        const { error } = validateLog(logData);
        if (!error) {
            const log = new ApiLog(logData);
            log.save().catch((error) => logger.error("Error logging API request:", error.message));
        } else {
            logger.error(
                `Log validation failed:
        ${error.details.map((e) => e.message)}`,
            );
            next(error);
        }

        // Send the response to the client
        return originalSend(body);
    };

    next();
};

export default apiLogger;
