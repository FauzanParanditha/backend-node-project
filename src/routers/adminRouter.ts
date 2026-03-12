import express from "express";
import {
    admin,
    dashboard,
    dashboardChart,
    deleteAdmin,
    getAllAdmin,
    register,
    updateAdmin,
} from "../controllers/adminController.js";
import {
    getAllActivityLog,
    getAllApiLog,
    getAllCallbackLog,
    getAllEmailLog,
    getAllFailedCallbackLog,
} from "../controllers/apiLogController.js";
import { retryCallback } from "../controllers/retryCallbackController.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { jwtUnifiedMiddleware } from "../middlewares/jwtUnified.js";
import { requirePermission } from "../middlewares/requirePermission.js";

const router = express.Router();

// Admin CRUD
router.get("/admins", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.ADMIN_LIST), getAllAdmin);
router.get("/admin/:id", jwtUnifiedMiddleware, admin);
router.post("/register", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.ADMIN_CREATE), register);
router.put("/admin/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.ADMIN_UPDATE), updateAdmin);
router.delete("/admin/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.ADMIN_DELETE), deleteAdmin);

// Logs
router.get("/apilogs", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.LOG_API), getAllApiLog);
router.get("/emaillogs", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.LOG_EMAIL), getAllEmailLog);
router.get("/callbacklogs", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.LOG_CALLBACK), getAllCallbackLog);
router.get("/failed-callbacklogs", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.LOG_CALLBACK), getAllFailedCallbackLog);
router.get("/activitylogs", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.LOG_ACTIVITY), getAllActivityLog);

// Retry
router.post("/retry/callback/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.LOG_RETRY), retryCallback);

// Dashboard (unified: admin sees all, user sees scoped)
router.get("/dashboard", jwtUnifiedMiddleware, dashboard);
router.get("/dashboard/chart", jwtUnifiedMiddleware, dashboardChart);

export default router;
