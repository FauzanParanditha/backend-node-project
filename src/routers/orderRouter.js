import express from "express";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { createOrder, editOrder, order, orders } from "../controllers/orderController.js";
import { balance, xenditCallback } from "../controllers/xenditController.js";
import { paylabsCallback, paylabsVaStaticCallback } from "../controllers/paymentController.js";
import { cancleQris, createQris, qrisOrderStatus } from "../controllers/qrisController.js";
import { ccOrderStatus, createCreditCard } from "../controllers/ccController.js";
import { createVASNAP, updateVASNAP, VaSnapCallback, vaSNAPOrderStatus } from "../controllers/vaSnapController.js";
import { createStaticVa, createVA, vaOrderStatus } from "../controllers/vaController.js";
import { createEMoney, createEMoneyRefund, eMoneyOrderStatus } from "../controllers/eMoneyController.js";
import { jwtMiddlewareVerify } from "../middlewares/verifyMiddleware.js";

const router = express.Router();

router.get("/orders", jwtMiddlewareAdmin, orders);
router.post("/order/create", jwtMiddlewareVerify, createOrder);
router.post("/order/webhook/xendit", xenditCallback);
router.get("/order/:id", jwtMiddlewareAdmin, order);
router.put("/order/:id", jwtMiddlewareAdmin, editOrder);

router.get("/xendit/balance", jwtMiddlewareAdmin, balance);

// paylabs
router.post("/order/webhook/paylabs", paylabsCallback);

router.post("/order/create/qris", jwtMiddlewareVerify, createQris);
router.get("/order/status/qris/:id", jwtMiddlewareVerify, qrisOrderStatus);
router.post("/order/cancel/qris/:id", jwtMiddlewareVerify, cancleQris);

router.post("/order/create/va/snap", jwtMiddlewareVerify, createVASNAP);
router.get("/order/status/va/snap/:id", jwtMiddlewareVerify, vaSNAPOrderStatus);
router.post("/order/webhook/paylabs/vaSnap", VaSnapCallback);
router.post("/order/update/va/snap/:id", jwtMiddlewareVerify, updateVASNAP);

router.post("/order/create/va", jwtMiddlewareVerify, createVA);
router.get("/order/status/va/:id", jwtMiddlewareVerify, vaOrderStatus);
router.post("/order/create/va/static", jwtMiddlewareVerify, createStaticVa);
router.post("/order/webhook/paylabs/va", paylabsVaStaticCallback);

router.post("/order/create/cc", jwtMiddlewareVerify, createCreditCard);
router.get("/order/status/cc/:id", jwtMiddlewareVerify, ccOrderStatus);

router.post("/order/create/ewallet", jwtMiddlewareVerify, createEMoney);
router.get("/order/status/ewallet/:id", jwtMiddlewareVerify, eMoneyOrderStatus);
router.post("/order/refund/ewallet/:id", jwtMiddlewareVerify, createEMoneyRefund);

export default router;
