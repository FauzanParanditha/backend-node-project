import express from "express";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { createPaymentLink } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/payment/createLink", jwtMiddlewareAdmin, createPaymentLink);

export default router;
