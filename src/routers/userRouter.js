import express from "express";
import {
  deleteUser,
  getAllUser,
  register,
} from "../controllers/userController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";

const router = express.Router();

router.get("/users", jwtMiddlewareAdmin, getAllUser);
router.post("/register", register);
router.delete("/user/:id", jwtMiddlewareAdmin, deleteUser);

export default router;
