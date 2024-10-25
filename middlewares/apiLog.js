import ApiLog from "../models/apiLogModel.js";
import { validateLog } from "../validators/apiLogValidator.js";

const apiLogger = async (req, res, next) => {
  const logData = {
    method: req.method,
    endpoint: req.originalUrl,
    headers: req.headers,
    body: req.body,
    statusCode: null,
    ipAddress: req.ip || req.connection.remoteAddress,
  };

  const originalSend = res.send.bind(res);

  res.send = async function (...args) {
    logData.statusCode = res.statusCode;

    const { error } = validateLog(logData);

    if (!error) {
      try {
        const log = new ApiLog(logData);
        await log.save();
      } catch (error) {
        console.error("Error logging API request:", error.message);
      }
    } else {
      console.error(
        "Log validation failed:",
        error.details.map((e) => e.message)
      );
    }

    return originalSend(...args);
  };

  next();
};

export default apiLogger;
