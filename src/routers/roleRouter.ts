import express from "express";
import {
    createRole,
    deleteRole,
    getAllRoles,
    getPermissions,
    getRole,
    updateRole,
} from "../controllers/roleController.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { requirePermission } from "../middlewares/requirePermission.js";

const router = express.Router();

router.get("/roles", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.ROLE_LIST), getAllRoles);
router.get("/role/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.ROLE_READ), getRole);
router.post("/role", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.ROLE_CREATE), createRole);
router.put("/role/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.ROLE_UPDATE), updateRole);
router.delete("/role/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.ROLE_DELETE), deleteRole);
router.get("/permissions", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.ROLE_LIST), getPermissions);

export default router;
