import express from "express";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { createOrder, orders } from "../controllers/orderController.js";

const router = express.Router();

router.get("/orders", jwtMiddlewareAdmin, orders);
router.post("/order/create", jwtMiddlewareAdmin, createOrder);
// router.post("/payment/complete", jwtMiddlewareAdmin, handlePayment);

export default router;
