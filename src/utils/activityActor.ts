import type { Request } from "express";
import { isAdminRole, normalizeAdminActivityRole } from "./authRole.js";

type ActivityRole = "admin" | "finance" | "user" | "client";

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
            role: normalizeAdminActivityRole(role),
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
): { actorId: string; role: Extract<ActivityRole, "admin" | "finance"> } | null => {
    const { adminId, role } = req.admin ?? {};

    if (!adminId) return null;

    return {
        actorId: adminId.toString(),
        role: normalizeAdminActivityRole(role),
    };
};

export const getAuthActivityActor = (req: Request): { actorId: string; role: ActivityRole } | null => {
    return resolveActivityActor(req.auth ?? {});
};
