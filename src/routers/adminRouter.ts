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
    getCallbackLogById,
} from "../controllers/apiLogController.js";
import {
    forceBlock,
    getIpEndpointStats,
    getIpHistory,
    getIpRequestLog,
    listBlocked,
    unblock,
} from "../controllers/blockedIpController.js";
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
// Unified middleware so client (merchant) users can view their OWN callback
// logs too — the controller scopes non-admin requests to the user's clients.
router.get("/callbacklogs", jwtUnifiedMiddleware, requirePermission(PERMISSIONS.LOG_CALLBACK), getAllCallbackLog);
router.get("/callbacklogs/:id", jwtUnifiedMiddleware, requirePermission(PERMISSIONS.LOG_CALLBACK), getCallbackLogById);
router.get("/failed-callbacklogs", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.LOG_CALLBACK), getAllFailedCallbackLog);
router.get("/activitylogs", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.LOG_ACTIVITY), getAllActivityLog);

// Retry
router.post("/retry/callback/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.LOG_RETRY), retryCallback);

// Blocked IPs
router.get("/blocked-ips", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.BLOCKED_IP_LIST), listBlocked);
router.get("/blocked-ips/:ip", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.BLOCKED_IP_LIST), getIpHistory);
router.get("/blocked-ips/:ip/requests", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.BLOCKED_IP_LIST), getIpRequestLog);
router.get("/blocked-ips/:ip/endpoints", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.BLOCKED_IP_LIST), getIpEndpointStats);
router.post("/blocked-ips/:ip/unblock", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.BLOCKED_IP_MANAGE), unblock);
router.post("/blocked-ips/:ip/block", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.BLOCKED_IP_MANAGE), forceBlock);

// Dashboard (unified: admin sees all, user sees scoped)
router.get("/dashboard", jwtUnifiedMiddleware, dashboard);
router.get("/dashboard/chart", jwtUnifiedMiddleware, dashboardChart);

export default router;
