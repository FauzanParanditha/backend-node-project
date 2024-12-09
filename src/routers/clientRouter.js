import express from "express";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { client, createClient, deleteClient, getAllClient, updateClient } from "../controllers/clientController.js";

const router = express.Router();

router.get("/client", jwtMiddlewareAdmin, getAllClient);
router.post("/client", jwtMiddlewareAdmin, createClient);
router.get("/client/:id", jwtMiddlewareAdmin, client);
router.put("/client/:id", jwtMiddlewareAdmin, updateClient);
router.delete("/client/:id", jwtMiddlewareAdmin, deleteClient);

export default router;
