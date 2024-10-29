import ApiLog from "../models/apiLogModel.js";
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
    logData.response = body;

    const { error } = validateLog(logData);
    if (!error) {
      const log = new ApiLog(logData);
      log
        .save()
        .catch((err) =>
          console.error("Error logging API request:", err.message)
        );
    } else {
      console.error(
        "Log validation failed:",
        error.details.map((e) => e.message)
      );
    }

    // Send the response to the client
    return originalSend(body);
  };

  next();
};

export default apiLogger;
