import express from "express";
import {
    availablePayment,
    availablePayments,
    createAvailablePayment,
    deleteAvailablepayment,
    updateAvailablePayment,
} from "../controllers/availablePaymentController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { upload } from "../utils/helper.js";

const router = express.Router();

router.get("/available-payment", availablePayments);
router.post("/available-payment", jwtMiddlewareAdmin, upload.single("image"), createAvailablePayment);
router.get("/available-payment/:id", availablePayment);
router.put("/available-payment/:id", jwtMiddlewareAdmin, upload.single("image"), updateAvailablePayment);
router.delete("/available-payment/:id", jwtMiddlewareAdmin, deleteAvailablepayment);

export default router;
