import CallbackLog from "../models/callbackLogModel.js";

export const logCallback = async ({
    type,
    source,
    target,
    status,
    payload,
    response = null,
    errorMessage = null,
    requestId = null,
}) => {
    try {
        await CallbackLog.create({
            type,
            source,
            target,
            status,
            payload,
            response,
            errorMessage,
            requestId,
        });
    } catch (err) {
        console.error("Failed to log callback:", err.message);
    }
};
