import express from "express";
import {
    changePassword,
    login,
    logout,
    sendForgotPassword,
    sendVerificationCode,
    verifyForgotPasswordCode,
    verifyVerificationCode,
} from "../controllers/authController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";

const router = express.Router();

router.post("/login", login);
router.post("/logout", jwtMiddlewareAdmin, logout);

router.patch("/send-verification-code", jwtMiddlewareAdmin, sendVerificationCode);
router.patch("/verify-verification-code", jwtMiddlewareAdmin, verifyVerificationCode);

router.patch("/change-password", jwtMiddlewareAdmin, changePassword);
router.patch("/send-forgot-password-code", sendForgotPassword);
router.patch("/verify-forgot-password-code", verifyForgotPasswordCode);
export default router;
