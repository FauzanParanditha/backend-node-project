import express from "express";
import {
  changePassword,
  login,
  logout,
  register,
  sendForgotPassword,
  sendVerficationCode,
  verifyForgotPasswordCode,
  verifyVerificationCode,
} from "../controllers/authController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", jwtMiddlewareAdmin, logout);

router.patch(
  "/send-verification-code",
  jwtMiddlewareAdmin,
  sendVerficationCode
);
router.patch(
  "/verify-verification-code",
  jwtMiddlewareAdmin,
  verifyVerificationCode
);

router.patch("/change-password", jwtMiddlewareAdmin, changePassword);
router.patch(
  "/send-forgot-password-code",
  jwtMiddlewareAdmin,
  sendForgotPassword
);
router.patch(
  "/verify-forgot-password-code",
  jwtMiddlewareAdmin,
  verifyForgotPasswordCode
);
export default router;