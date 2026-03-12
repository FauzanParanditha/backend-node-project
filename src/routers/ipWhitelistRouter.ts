import express from "express";
import {
    create,
    deleteIpWhitelist,
    ipWhitelist,
    ipWhitelists,
    updateIpWhitelist,
} from "../controllers/ipWhitelistController.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { requirePermission } from "../middlewares/requirePermission.js";

const router = express.Router();

router.get("/whitelist", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.WHITELIST_LIST), ipWhitelists);
router.post("/whitelist", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.WHITELIST_CREATE), create);
router.get("/whitelist/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.WHITELIST_READ), ipWhitelist);
router.put("/whitelist/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.WHITELIST_UPDATE), updateIpWhitelist);
router.delete("/whitelist/:id", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.WHITELIST_DELETE), deleteIpWhitelist);

export default router;
