import express from "express";
import { createProduct, deleteProduct, product, products, updateProduct } from "../controllers/productController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { upload } from "../utils/helper.js";

const router = express.Router();

router.get("/products", products);
router.post("/product", upload.single("image"), jwtMiddlewareAdmin, createProduct);
router.get("/product/:id", product);
router.put("/product/:id", upload.single("image"), jwtMiddlewareAdmin, updateProduct);
router.delete("/product/:id", jwtMiddlewareAdmin, deleteProduct);

export default router;
