import express from "express";
import { categories, category, create, deleteCategory, updateCategory } from "../controllers/categoryController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";

const router = express.Router();

router.get("/categories", categories);
router.post("/category", jwtMiddlewareAdmin, create);
router.get("/category/:id", category);
router.put("/category/:id", jwtMiddlewareAdmin, updateCategory);
router.delete("/category/:id", jwtMiddlewareAdmin, deleteCategory);

export default router;
