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
import { jwtMiddleware } from "../middlewares/jwt.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";

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
 *                 example: admin@example.com
 *               password:
 *                 type: string
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
router.post("/login", login);
router.post("/logout", jwtMiddleware, logout);

router.patch("/send-verification-code", jwtMiddleware, sendVerificationCode);
router.patch("/verify-verification-code", jwtMiddleware, verifyVerificationCode);

router.patch("/change-password", jwtMiddleware, changePassword);
router.patch("/adm/change-password", jwtMiddlewareAdmin, changePasswordByAdmin);
router.patch("/send-forgot-password-code", jwtMiddleware, sendForgotPassword);
router.patch("/verify-forgot-password-code", jwtMiddleware, verifyForgotPasswordCode);
export default router;
