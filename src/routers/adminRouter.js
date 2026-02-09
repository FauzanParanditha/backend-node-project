import express from "express";
import { admin, dashboard, deleteAdmin, getAllAdmin, register, updateAdmin } from "../controllers/adminController.js";
import {
    getAllApiLog,
    getAllCallbackLog,
    getAllEmailLog,
    getAllFailedCallbackLog,
} from "../controllers/apiLogController.js";
import { retryCallback } from "../controllers/retryCallbackController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { jwtUnifiedMiddleware } from "../middlewares/jwtUnified.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/adm/dashboard:
 *   get:
 *     summary: Dashboard data (admin or user scoped)
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access forbidden
 */
router.get("/admins", jwtMiddlewareAdmin, getAllAdmin);
/**
 * @swagger
 * /api/v1/adm/admin/{id}:
 *   get:
 *     summary: Admin detail (admin) or self user profile (user)
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Admin or user data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access forbidden
 */
router.get("/admin/:id", jwtUnifiedMiddleware, admin);
router.post("/register", jwtMiddlewareAdmin, register);
router.put("/admin/:id", jwtMiddlewareAdmin, updateAdmin);
router.delete("/admin/:id", jwtMiddlewareAdmin, deleteAdmin);

router.get("/apilogs", jwtMiddlewareAdmin, getAllApiLog);
router.get("/emaillogs", jwtMiddlewareAdmin, getAllEmailLog);
router.get("/callbacklogs", jwtMiddlewareAdmin, getAllCallbackLog);
router.get("/failed-callbacklogs", jwtMiddlewareAdmin, getAllFailedCallbackLog);

router.post("/retry/callback/:id", jwtMiddlewareAdmin, retryCallback);

router.get("/dashboard", jwtUnifiedMiddleware, dashboard);
export default router;
