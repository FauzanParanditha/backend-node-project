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

export const safeStringify = (obj) => {
    const seen = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return; // Circular reference found, return undefined to omit the property
            }
            seen.add(value);
        }
        return value;
    });
};
