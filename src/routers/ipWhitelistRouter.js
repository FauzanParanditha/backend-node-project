import express from "express";
import {
  create,
  deleteIpWhitelist,
  ipWhitelist,
  ipWhitelists,
  updateIpWhitelist,
} from "../controllers/ipWhitelistController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";

const router = express.Router();

router.get("/whitelist", jwtMiddlewareAdmin, ipWhitelists);
router.post("/whitelist", jwtMiddlewareAdmin, create);
router.get("/whitelist/:id", jwtMiddlewareAdmin, ipWhitelist);
router.put("/whitelist/:id", jwtMiddlewareAdmin, updateIpWhitelist);
router.delete("/whitelist/:id", jwtMiddlewareAdmin, deleteIpWhitelist);

export default router;
