import logger from "../application/logger.js";
import ApiLog from "../models/apiLogModel.js";
import { validateLog } from "../validators/apiLogValidator.js";

const apiLogger = async (req, res, next) => {
    const logData = {
        method: req.method,
        endpoint: req.originalUrl,
        headers: req.headers,
        body:
            req.is("application/json") || req.is("application/*+json")
                ? req.body
                : req.body instanceof Buffer
                  ? req.body.toString("utf8")
                  : req.body,
        ipAddress: req.ip || req.connection.remoteAddress,
        statusCode: null,
    };

    const originalSend = res.send.bind(res);

    res.send = function (body) {
        logData.statusCode = res.statusCode;

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

        return originalSend(body);
    };

    next();
};

export default apiLogger;
