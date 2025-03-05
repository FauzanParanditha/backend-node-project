import express from "express";
import { admin, dashboard, deleteAdmin, getAllAdmin, register, updateAdmin } from "../controllers/adminController.js";
import { getAllApiLog, getAllCallbackLog, getAllEmailLog } from "../controllers/apiLogController.js";
import { retryCallback } from "../controllers/retryCallbackController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";

const router = express.Router();

router.get("/admins", jwtMiddlewareAdmin, getAllAdmin);
router.get("/admin/:id", jwtMiddlewareAdmin, admin);
router.post("/register", jwtMiddlewareAdmin, register);
router.put("/admin/:id", jwtMiddlewareAdmin, updateAdmin);
router.delete("/admin/:id", jwtMiddlewareAdmin, deleteAdmin);

router.get("/apilogs", jwtMiddlewareAdmin, getAllApiLog);
router.get("/emaillogs", jwtMiddlewareAdmin, getAllEmailLog);
router.get("/callbacklogs", jwtMiddlewareAdmin, getAllCallbackLog);

router.post("/retry/callback/:id", jwtMiddlewareAdmin, retryCallback);

router.get("/dashboard", jwtMiddlewareAdmin, dashboard);
export default router;
