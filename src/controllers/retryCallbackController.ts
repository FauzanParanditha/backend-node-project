import type { Request, Response, NextFunction } from "express";
import logger from "../application/logger.js";
import Admin from "../models/adminModel.js";
import * as forwardCallbackService from "../service/forwadCallback.js";
import { getAdminActivityActor } from "../utils/activityActor.js";

export const retryCallback = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const callbackId = req.params.id;

    // Validate the callback ID (you can add more validation as needed)
    if (!callbackId) {
        return res.status(400).json({ message: "Callback ID is required." });
    }

    const force = req.query.force === "true" || req.query.force === "1";

    let actor;
    if (force) {
        const adminActor = getAdminActivityActor(req);
        if (adminActor) {
            const admin = await Admin.findById(adminActor.actorId).select("email").lean();
            actor = {
                actorId: adminActor.actorId,
                role: adminActor.role,
                email: admin?.email,
                ipAddress: req.ip,
            };
        }
    }

    try {
        // Call the function to retry the callback
        const success = await forwardCallbackService.retryCallbackById(callbackId, force, actor);

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
