import type { NextFunction, Request, Response } from "express";
import type { Permission } from "../constants/permissions.js";
import logger from "../application/logger.js";
import Role from "../models/roleModel.js";

/**
 * In-memory cache for role permissions.
 * Key = roleId string, Value = { permissions, cachedAt }.
 * TTL-based: entries older than CACHE_TTL_MS are re-fetched.
 */
interface CacheEntry {
    permissions: string[];
    cachedAt: number;
}

const roleCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Invalidate the cache for a specific role (call after role update/delete).
 */
export const invalidateRoleCache = (roleId: string): void => {
    roleCache.delete(roleId);
};

/**
 * Invalidate the entire role cache (call after bulk changes).
 */
export const invalidateAllRoleCache = (): void => {
    roleCache.clear();
};

/**
 * Resolve permissions for a given roleId — uses cache when possible.
 */
const resolvePermissions = async (roleId: string): Promise<string[] | null> => {
    const cached = roleCache.get(roleId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.permissions;
    }

    const role = await Role.findById(roleId).lean();
    if (!role) return null;

    roleCache.set(roleId, {
        permissions: role.permissions,
        cachedAt: Date.now(),
    });

    return role.permissions;
};

/**
 * Middleware factory that enforces permission-based access control.
 *
 * Usage in routers:
 * ```ts
 * router.get("/admins", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.ADMIN_LIST), getAllAdmin);
 * router.post("/role", jwtMiddlewareAdmin, requirePermission(PERMISSIONS.ROLE_CREATE), createRole);
 * ```
 *
 * The middleware expects `req.admin.roleId` or `req.auth.roleId` to be set
 * by a preceding JWT middleware (jwtMiddlewareAdmin or jwtUnifiedMiddleware).
 */
export const requirePermission = (...requiredPermissions: Permission[]) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Resolve roleId from either admin or unified auth context
            const roleId = (req.admin as any)?.roleId ?? (req.auth as any)?.roleId;

            if (!roleId) {
                res.status(403).json({
                    success: false,
                    message: "Access denied: no role assigned",
                });
                return;
            }

            const permissions = await resolvePermissions(String(roleId));

            if (!permissions) {
                res.status(403).json({
                    success: false,
                    message: "Access denied: role not found",
                });
                return;
            }

            const hasAll = requiredPermissions.every((p) => permissions.includes(p));

            if (!hasAll) {
                res.status(403).json({
                    success: false,
                    message: "Access denied: insufficient permissions",
                    required: requiredPermissions,
                });
                return;
            }

            // Attach permissions to request for downstream use (e.g., conditional data scoping)
            (req as any).permissions = permissions;

            next();
        } catch (error) {
            logger.error(`Error requirePermission: ${(error as Error).message}`);
            next(error);
        }
    };
};
