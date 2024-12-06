import express from "express";
import {
    availablePayment,
    availablePayments,
    createAvailablePayment,
    deleteAvailablepayment,
    updateAvailablePayment,
} from "../controllers/availablePaymentController.js";
import { upload } from "../utils/helper.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";

const router = express.Router();

router.get("/available-payment", availablePayments);
router.post("/available-payment", upload.single("image"), jwtMiddlewareAdmin, createAvailablePayment);
router.get("/available-payment/:id", availablePayment);
router.put("/available-payment/:id", upload.single("image"), jwtMiddlewareAdmin, updateAvailablePayment);
router.delete("/available-payment/:id", jwtMiddlewareAdmin, deleteAvailablepayment);

export default router;
