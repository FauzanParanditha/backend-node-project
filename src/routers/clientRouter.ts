import express from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { jwtUnifiedMiddleware } from "../middlewares/jwtUnified.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { client, createClient, deleteClient, getAllClient, updateClient } from "../controllers/clientController.js";

const router = express.Router();

router.get("/client", jwtUnifiedMiddleware, getAllClient);
router.post("/client", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.CLIENT_CREATE), createClient);
router.get("/client/:id", jwtUnifiedMiddleware, client);
router.put("/client/:id", jwtUnifiedMiddleware, updateClient);
router.delete("/client/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.CLIENT_DELETE), deleteClient);

export default router;
