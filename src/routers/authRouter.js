import express from "express";
import {
    changePassword,
    logout,
    sendForgotPassword,
    sendVerificationCode,
    verifyForgotPasswordCode,
    verifyVerificationCode,
} from "../controllers/authController.js";
import { jwtUnifiedMiddleware } from "../middlewares/jwtUnified.js";

const router = express.Router();

/**
 * @swagger
 * /adm/auth/send-verification-code:
 *   patch:
 *     summary: Send verification code (admin or user)
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Code sent
 *       401:
 *         description: Unauthorized
 */
router.post("/logout", jwtUnifiedMiddleware, logout);

/**
 * @swagger
 * /adm/auth/verify-verification-code:
 *   patch:
 *     summary: Verify verification code (admin or user)
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - provided_code
 *             properties:
 *               email:
 *                 type: string
 *               provided_code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verified
 *       401:
 *         description: Unauthorized
 */
router.patch("/send-verification-code", jwtUnifiedMiddleware, sendVerificationCode);
router.patch("/verify-verification-code", jwtUnifiedMiddleware, verifyVerificationCode);

/**
 * @swagger
 * /adm/auth/change-password:
 *   patch:
 *     summary: Change password (admin or user)
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - old_password
 *               - new_password
 *             properties:
 *               old_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed
 *       401:
 *         description: Unauthorized
 */
router.patch("/change-password", jwtUnifiedMiddleware, changePassword);
export default router;
