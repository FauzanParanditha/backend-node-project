import express from "express";
import {
  deleteAdmin,
  getAllAdmin,
  register,
} from "../controllers/adminController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { getAllApiLog } from "../controllers/apiLogController.js";

const router = express.Router();

router.get("/admins", jwtMiddlewareAdmin, getAllAdmin);
router.post("/register", register);
router.delete("/admin/:id", jwtMiddlewareAdmin, deleteAdmin);

router.get("/apilogs", jwtMiddlewareAdmin, getAllApiLog);

export default router;
