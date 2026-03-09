import type { Request, Response, NextFunction } from "express";
import logger from "../application/logger.js";
import * as forwardCallbackService from "../service/forwadCallback.js";

export const retryCallback = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const callbackId = req.params.id;

    // Validate the callback ID (you can add more validation as needed)
    if (!callbackId) {
        return res.status(400).json({ message: "Callback ID is required." });
    }

    try {
        // Call the function to retry the callback
        const success = await forwardCallbackService.retryCallbackById(callbackId);

        if (success) {
            return res
                .status(200)
                .json({ success: true, message: `Successfully retried callback with ID: ${callbackId}` });
        } else {
            return res
                .status(202)
                .json({ success: false, message: `Retry failed. Callback will be retried again later.` });
        }
    } catch (error) {
        // Handle any errors that occurred during the retry process
        logger.error(`Error retrying callback: ${(error as Error).message}`);
        next(error);
    }
};
