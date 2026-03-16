import { ResponseError } from "../error/responseError.js";
import type { Permission } from "../constants/permissions.js";
import { ALL_PERMISSIONS } from "../constants/permissions.js";
import Admin from "../models/adminModel.js";
import Role from "../models/roleModel.js";
import type { IRole } from "../models/roleModel.js";
import { invalidateRoleCache } from "../middlewares/requirePermission.js";

/**
 * List all roles.
 */
export const getAllRoles = async (): Promise<IRole[]> => {
    return Role.find().sort({ isSystem: -1, name: 1 }).lean();
};

/**
 * Get a single role by ID.
 */
export const getRoleById = async (id: string): Promise<IRole> => {
    const role = await Role.findById(id).lean();
    if (!role) throw new ResponseError(404, "Role not found");
    return role;
};

/**
 * Create a new role.
 */
export const createRole = async ({
    name,
    description,
    permissions,
}: {
    name: string;
    description?: string;
    permissions: Permission[];
}): Promise<IRole> => {
    const existing = await Role.findOne({ name: { $eq: name.trim() } });
    if (existing) throw new ResponseError(400, "Role with this name already exists");

    const role = new Role({ name: name.trim(), description, permissions });
    return role.save();
};

/**
 * Update an existing role. System roles can have their permissions changed
 * but not their name.
 */
export const updateRole = async (
    id: string,
    updates: { name?: string; description?: string; permissions?: Permission[] },
): Promise<IRole> => {
    const role = await Role.findById(id);
    if (!role) throw new ResponseError(404, "Role not found");

    // System roles cannot be renamed
    if (role.isSystem && updates.name && updates.name !== role.name) {
        throw new ResponseError(400, "Cannot rename a system role");
    }

    // Check for duplicate names
    if (updates.name && updates.name !== role.name) {
        const duplicate = await Role.findOne({ name: { $eq: updates.name.trim() } });
        if (duplicate) throw new ResponseError(400, "Role with this name already exists");
    }

    if (updates.name !== undefined) role.name = updates.name.trim();
    if (updates.description !== undefined) role.description = updates.description;
    if (updates.permissions !== undefined) role.permissions = updates.permissions;

    const saved = await role.save();

    // Invalidate cache for this role
    invalidateRoleCache(id);

    return saved;
};

/**
 * Delete a role. System roles cannot be deleted.
 * Admins assigned to this role must be re-assigned first.
 */
export const deleteRole = async (id: string): Promise<void> => {
    const role = await Role.findById(id);
    if (!role) throw new ResponseError(404, "Role not found");

    if (role.isSystem) {
        throw new ResponseError(400, "Cannot delete a system role");
    }

    // Check if any admins are still assigned to this role
    const adminsWithRole = await Admin.countDocuments({ roleId: id });
    if (adminsWithRole > 0) {
        throw new ResponseError(
            400,
            `Cannot delete role: ${adminsWithRole} admin(s) still assigned. Reassign them first.`,
        );
    }

    await Role.findByIdAndDelete(id);
    invalidateRoleCache(id);
};

/**
 * Return all available permissions as a flat list.
 */
export const getAvailablePermissions = (): { permissions: Permission[]; total: number } => {
    return {
        permissions: ALL_PERMISSIONS,
        total: ALL_PERMISSIONS.length,
    };
};
