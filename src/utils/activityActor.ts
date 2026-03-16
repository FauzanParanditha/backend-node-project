import type { Request } from "express";
import { isAdminRole } from "./authRole.js";

type ActivityRole = "admin" | "finance" | "super_admin" | "user" | "client";

export const resolveActivityActor = ({
    role,
    adminId,
    userId,
}: {
    role?: string;
    adminId?: string | { toString(): string };
    userId?: string | { toString(): string };
}): { actorId: string; role: ActivityRole } | null => {
    if (isAdminRole(role)) {
        if (!adminId) return null;

        return {
            actorId: adminId.toString(),
            role: role as Extract<ActivityRole, "admin" | "finance" | "super_admin">,
        };
    }

    if (role === "user" || role === "client") {
        if (!userId) return null;

        return {
            actorId: userId.toString(),
            role,
        };
    }

    return null;
};

export const getAdminActivityActor = (
    req: Request,
): { actorId: string; role: Extract<ActivityRole, "admin" | "finance" | "super_admin"> } | null => {
    const { adminId, role } = req.admin ?? {};

    if (!adminId || !isAdminRole(role)) return null;

    return {
        actorId: adminId.toString(),
        role: role as Extract<ActivityRole, "admin" | "finance" | "super_admin">,
    };
};

export const getAuthActivityActor = (req: Request): { actorId: string; role: ActivityRole } | null => {
    return resolveActivityActor(req.auth ?? {});
};
