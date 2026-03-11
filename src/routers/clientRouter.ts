import express from "express";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { jwtUnifiedMiddleware } from "../middlewares/jwtUnified.js";
import { client, createClient, deleteClient, getAllClient, updateClient } from "../controllers/clientController.js";

const router = express.Router();

router.get("/client", jwtUnifiedMiddleware, getAllClient);
router.post("/client", jwtMiddlewareAdmin, createClient);
router.get("/client/:id", jwtUnifiedMiddleware, client);
router.put("/client/:id", jwtUnifiedMiddleware, updateClient);
router.delete("/client/:id", jwtMiddlewareAdmin, deleteClient);

export default router;
