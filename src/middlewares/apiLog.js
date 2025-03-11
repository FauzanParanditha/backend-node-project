import logger from "../application/logger.js";
import ApiLog from "../models/apiLogModel.js";
import { validateLog } from "../validators/apiLogValidator.js";

const MAX_BODY_LENGTH = 10 * 1024;

const apiLogger = async (req, res, next) => {
    const logData = {
        method: req.method,
        endpoint: req.originalUrl,
        headers: req.headers,
        body:
            req.body instanceof Buffer
                ? req.body.toString("utf8") // Buffer => String
                : req.body,
        ipAddress: req.ip || req.connection.remoteAddress,
        statusCode: null,
    };

    if (JSON.stringify(logData.body).length > MAX_BODY_LENGTH) {
        logData.body = "***BODY TOO LARGE - TRUNCATED***";
    }

    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);

    const logResponse = () => {
        logData.statusCode = res.statusCode;
        const { error } = validateLog(logData);
        if (!error) {
            new ApiLog(logData).save().catch((err) => logger.error(`❌ Error saving API log: ${err.message}`));
        } else {
            logger.error(`❌ Log validation failed: ${error.details.map((e) => e.message)}`);
        }
    };

    res.send = function (body) {
        logResponse();
        return originalSend(body);
    };

    res.json = function (body) {
        logResponse();
        return originalJson(body);
    };

    res.end = function (body) {
        logResponse();
        return originalEnd(body);
    };

    next();
};

export default apiLogger;
