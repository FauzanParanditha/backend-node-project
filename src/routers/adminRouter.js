import express from "express";
import { deleteAdmin, getAllAdmin } from "../controllers/adminController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { apiLogs } from "../controllers/apiLogController.js";

const router = express.Router();

router.get("/admins", jwtMiddlewareAdmin, getAllAdmin);
router.delete("/admin/:id", jwtMiddlewareAdmin, deleteAdmin);

router.get("/apilogs", jwtMiddlewareAdmin, apiLogs);

export default router;
