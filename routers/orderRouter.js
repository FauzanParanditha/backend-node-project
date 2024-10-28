import express from "express";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import {
  createOrder,
  editOrder,
  order,
  orders,
} from "../controllers/orderController.js";
import { balance, xenditCallback } from "../controllers/xenditController.js";

const router = express.Router();

router.get("/orders", jwtMiddlewareAdmin, orders);
router.post("/order/create", jwtMiddlewareAdmin, createOrder);
router.post("/order/webhook/xendit", xenditCallback);
router.get("/order/:id", order);
router.put("/order/:id", jwtMiddlewareAdmin, editOrder);

router.get("/xendit/balance", jwtMiddlewareAdmin, balance);

export default router;
