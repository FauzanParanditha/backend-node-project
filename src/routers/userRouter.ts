import express from "express";
import { deleteUser, getAllUser, register, updateUser, user } from "../controllers/userController.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { requirePermission } from "../middlewares/requirePermission.js";

const router = express.Router();

router.get("/users", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.USER_LIST), getAllUser);
router.get("/user/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.USER_READ), user);
router.post("/register", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.USER_CREATE), register);
router.put("/user/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.USER_UPDATE), updateUser);
router.delete("/user/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.USER_DELETE), deleteUser);

export default router;
