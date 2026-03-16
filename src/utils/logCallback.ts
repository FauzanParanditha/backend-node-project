import CallbackLog from "../models/callbackLogModel.js";

interface LogCallbackParams {
    type: string;
    source: string;
    target: string;
    status: string;
    payload: Record<string, unknown>;
    response?: Record<string, unknown> | null;
    errorMessage?: string | null;
    requestId?: string | null;
}

export const logCallback = async ({
    type,
    source,
    target,
    status,
    payload,
    response = null,
    errorMessage = null,
    requestId = null,
}: LogCallbackParams): Promise<void> => {
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
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Failed to log callback:", message);
    }
};

export const safeStringify = (obj: unknown): string => {
    const seen = new Set<unknown>();
    return JSON.stringify(obj, (_key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return; // Circular reference found, return undefined to omit the property
            }
            seen.add(value);
        }
        return value;
    });
};
