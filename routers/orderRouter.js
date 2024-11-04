import express from "express";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import {
  createOrder,
  editOrder,
  order,
  orders,
} from "../controllers/orderController.js";
import { balance, xenditCallback } from "../controllers/xenditController.js";
import { paylabsCallback } from "../controllers/paymentController.js";
import {
  cancleQris,
  createQris,
  qrisOrderStatus,
} from "../controllers/qrisController.js";
import {
  ccOrderStatus,
  createCreditCard,
} from "../controllers/ccController.js";
import { createVASNAP } from "../controllers/vaSnapController.js";
import { createVA } from "../controllers/vaController.js";

const router = express.Router();

router.get("/orders", jwtMiddlewareAdmin, orders);
router.post("/order/create", jwtMiddlewareAdmin, createOrder);
router.post("/order/webhook/xendit", xenditCallback);
router.post("/order/webhook/paylabs", paylabsCallback);
router.get("/order/:id", jwtMiddlewareAdmin, order);
router.put("/order/:id", jwtMiddlewareAdmin, editOrder);

router.get("/xendit/balance", jwtMiddlewareAdmin, balance);

router.post("/order/create/qris", jwtMiddlewareAdmin, createQris);
router.get("/order/status/qris/:id", jwtMiddlewareAdmin, qrisOrderStatus);
router.post("/order/cancel/qris/:id", jwtMiddlewareAdmin, cancleQris);

router.post("/order/create/vaSnap", jwtMiddlewareAdmin, createVASNAP);

router.post("/order/create/va", jwtMiddlewareAdmin, createVA);

router.post("/order/create/cc", jwtMiddlewareAdmin, createCreditCard);
router.post("/order/status/cc/:id", jwtMiddlewareAdmin, ccOrderStatus);

export default router;
