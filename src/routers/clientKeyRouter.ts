import express from "express";
import {
    clientKey,
    createClientKey,
    deleteClientKey,
    getAllClientKey,
    updateClientKey,
} from "../controllers/clientKeyController.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { jwtUnifiedMiddleware } from "../middlewares/jwtUnified.js";
import { requirePermission } from "../middlewares/requirePermission.js";

const router = express.Router();

router.get("/client-key", jwtUnifiedMiddleware, getAllClientKey);
router.post("/client-key", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.CLIENT_KEY_CREATE), createClientKey);
router.get("/client-key/:id", jwtUnifiedMiddleware, clientKey);
router.put("/client-key/:id", jwtUnifiedMiddleware, updateClientKey);
router.delete("/client-key/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.CLIENT_KEY_DELETE), deleteClientKey);

export default router;
