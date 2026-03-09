import express from "express";
import { deleteUser, getAllUser, register, updateUser, user } from "../controllers/userController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";

const router = express.Router();

router.get("/users", jwtMiddlewareAdmin, getAllUser);
router.get("/user/:id", jwtMiddlewareAdmin, user);
router.post("/register", jwtMiddlewareAdmin, register);
router.put("/user/:id", jwtMiddlewareAdmin, updateUser);
router.delete("/user/:id", jwtMiddlewareAdmin, deleteUser);

export default router;
