import express from "express";
import {
    changePassword,
    changePasswordByAdmin,
    login,
    logout,
    sendForgotPassword,
    sendVerificationCode,
    verifyForgotPasswordCode,
    verifyVerificationCode,
} from "../controllers/authControllerUser.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { jwtMiddleware } from "../middlewares/jwt.js";
import { loginLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Unified login for admin or user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 minLength: 1
 *                 maxLength: 64
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$'
 *                 description: Must contain at least 8 characters, one uppercase, one lowercase, one number and one special character
 *                 example: P@ssw0rd!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [admin, user]
 *                     adminId:
 *                       type: string
 *                       nullable: true
 *                     userId:
 *                       type: string
 *                       nullable: true
 *                     email:
 *                       type: string
 *                     expiresIn:
 *                       type: number
 *                       description: Token expiry in seconds
 *       400:
 *         description: Validation error or invalid credentials
 *       403:
 *         description: Access forbidden (admin login requires whitelisted IP)
 */
router.post("/login", loginLimiter, login);
router.post("/logout", jwtMiddleware, logout);

router.patch("/send-verification-code", jwtMiddleware, sendVerificationCode);
router.patch("/verify-verification-code", jwtMiddleware, verifyVerificationCode);

router.patch("/change-password", jwtMiddleware, changePassword);
router.patch("/adm/change-password", jwtMiddlewareAdmin, changePasswordByAdmin);
router.patch("/send-forgot-password-code", sendForgotPassword);
router.patch("/verify-forgot-password-code", verifyForgotPasswordCode);
export default router;
