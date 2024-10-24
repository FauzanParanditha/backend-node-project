import ApiLog from "../models/apiLogModel.js";
import { validateLog } from "../validators/apiLogValidator.js";

const apiLogger = async (req, res, next) => {
  const logData = {
    method: req.method,
    endpoint: req.originalUrl,
    headers: req.headers,
    body: req.body,
    ipAddress: req.ip || req.connection.remoteAddress,
  };

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

  next();
};

export default apiLogger;
