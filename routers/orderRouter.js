import express from "express";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { orders } from "../controllers/orderController.js";

const router = express.Router();

router.get("/orders", orders);

export default router;
