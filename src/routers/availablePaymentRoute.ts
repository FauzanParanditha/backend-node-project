import express from "express";
import {
    availablePayment,
    availablePayments,
    createAvailablePayment,
    deleteAvailablepayment,
    updateAvailablePayment,
} from "../controllers/availablePaymentController.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { jwtUnifiedMiddleware } from "../middlewares/jwtUnified.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { upload } from "../utils/helper.js";

const router = express.Router();

router.get("/available-payment", availablePayments);
router.post("/available-payment", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.PAYMENT_CREATE), upload.single("image"), createAvailablePayment);
router.get("/available-payment/:id", jwtUnifiedMiddleware, availablePayment);
router.put("/available-payment/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.PAYMENT_UPDATE), upload.single("image"), updateAvailablePayment);
router.delete("/available-payment/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.PAYMENT_DELETE), deleteAvailablepayment);

export default router;
