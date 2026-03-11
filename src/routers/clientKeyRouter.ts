import express from "express";
import {
    clientKey,
    createClientKey,
    deleteClientKey,
    getAllClientKey,
    updateClientKey,
} from "../controllers/clientKeyController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { jwtUnifiedMiddleware } from "../middlewares/jwtUnified.js";

const router = express.Router();

router.get("/client-key", jwtUnifiedMiddleware, getAllClientKey);
router.post("/client-key", jwtMiddlewareAdmin, createClientKey);
router.get("/client-key/:id", jwtUnifiedMiddleware, clientKey);
router.put("/client-key/:id", jwtUnifiedMiddleware, updateClientKey);
router.delete("/client-key/:id", jwtMiddlewareAdmin, deleteClientKey);

export default router;
