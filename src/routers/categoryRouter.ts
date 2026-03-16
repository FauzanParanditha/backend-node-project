import express from "express";
import { categories, category, create, deleteCategory, updateCategory } from "../controllers/categoryController.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { requirePermission } from "../middlewares/requirePermission.js";

const router = express.Router();

router.get("/categories", categories);
router.post("/category", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.CATEGORY_CREATE), create);
router.get("/category/:id", category);
router.put("/category/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.CATEGORY_UPDATE), updateCategory);
router.delete("/category/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.CATEGORY_DELETE), deleteCategory);

export default router;
