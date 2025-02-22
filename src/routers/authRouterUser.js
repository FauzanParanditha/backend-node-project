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

router.post("/login", login);
router.post("/logout", jwtMiddleware, logout);

router.patch("/send-verification-code", jwtMiddleware, sendVerificationCode);
router.patch("/verify-verification-code", jwtMiddleware, verifyVerificationCode);

router.patch("/change-password", jwtMiddleware, changePassword);
router.patch("/adm/change-password", jwtMiddlewareAdmin, changePasswordByAdmin);
router.patch("/send-forgot-password-code", jwtMiddleware, sendForgotPassword);
router.patch("/verify-forgot-password-code", jwtMiddleware, verifyForgotPasswordCode);
export default router;
