import express from "express";
import {
    clientKey,
    createClientKey,
    deleteClientKey,
    getAllClientKey,
    updateClientKey,
} from "../controllers/clientKeyController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";

const router = express.Router();

router.get("/client-key", jwtMiddlewareAdmin, getAllClientKey);
router.post("/client-key", jwtMiddlewareAdmin, createClientKey);
router.get("/client-key/:id", jwtMiddlewareAdmin, clientKey);
router.put("/client-key/:id", jwtMiddlewareAdmin, updateClientKey);
router.delete("/client-key/:id", jwtMiddlewareAdmin, deleteClientKey);

export default router;
