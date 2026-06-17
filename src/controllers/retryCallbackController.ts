import type { Request, Response, NextFunction } from "express";
import logger from "../application/logger.js";
import Admin from "../models/adminModel.js";
import * as forwardCallbackService from "../service/forwardCallback.js";
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
        // The retry is queued and runs in the background - the response
        // ships within milliseconds instead of waiting up to ~52 minutes
        // for the internal retry sequence to complete. Final outcome is
        // visible asynchronously via CallbackLog (success) or the
        // FailedCallback document status (failed -> retry pending,
        // dead -> max retry exceeded).
        const result = await forwardCallbackService.retryCallbackById(callbackId, force, actor);

        return res.status(202).json({
            success: true,
            message: `Retry queued. Final result will appear in callback logs.`,
            data: result,
        });
    } catch (error) {
        // Validation failures (404 not-found, 410 max-retry-exceeded) still
        // surface synchronously and propagate to the standard error middleware.
        logger.error(`Error retrying callback: ${(error as Error).message}`);
        next(error);
    }
};
