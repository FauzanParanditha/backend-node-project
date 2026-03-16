import mongoose from "mongoose";
import { connectDB } from "../application/db.js";
import logger from "../application/logger.js";
// Side-effect import: registers "Admin" model with Mongoose
import "../models/adminModel.js";
import Role from "../models/roleModel.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Migration script: converts existing admin documents from the old
 * `role: "admin" | "finance"` string field to the new `roleId` ObjectId
 * referencing the Role collection.
 *
 * Prerequisites:
 *   - Run `npm run seed:roles` first to ensure Role documents exist.
 *
 * This script is idempotent — safe to run multiple times.
 */
const migrateAdminRoles = async () => {
    try {
        connectDB();

        // Load all roles into a name→_id map
        const roles = await Role.find().lean();
        const roleMap = new Map<string, string>();
        for (const role of roles) {
            roleMap.set(role.name, String(role._id));
        }

        if (roleMap.size === 0) {
            logger.error("No roles found! Run `npm run seed:roles` first.");
            return;
        }

        // Default fallback role
        const defaultRoleId = roleMap.get("admin");
        if (!defaultRoleId) {
            logger.error('No "admin" role found! Run `npm run seed:roles` first.');
            return;
        }

        // Find all admins that still have the old `role` string field but no `roleId`
        // Using raw MongoDB operations to access the legacy `role` field
        const db = mongoose.connection.db;
        if (!db) {
            // Wait for connection
            await new Promise<void>((resolve) => {
                mongoose.connection.once("connected", () => resolve());
            });
        }

        const adminCollection = mongoose.connection.db!.collection("admins");
        const admins = await adminCollection.find({}).toArray();

        let migrated = 0;
        let skipped = 0;

        for (const admin of admins) {
            // Skip if already has a valid roleId
            if (admin.roleId) {
                skipped++;
                continue;
            }

            // Map the old role string to the new roleId
            const oldRole = (admin as any).role as string | undefined;
            let newRoleId: string;

            if (oldRole && roleMap.has(oldRole)) {
                newRoleId = roleMap.get(oldRole)!;
            } else {
                // Default to "admin" role if no match found
                newRoleId = defaultRoleId;
                logger.warn(`Admin ${admin.email}: unknown role "${oldRole}", defaulting to "admin"`);
            }

            await adminCollection.updateOne(
                { _id: admin._id },
                {
                    $set: { roleId: new mongoose.Types.ObjectId(newRoleId) },
                    $unset: { role: "" }, // Remove the old field
                },
            );

            migrated++;
            logger.info(`Admin ${admin.email}: migrated "${oldRole}" → roleId ${newRoleId}`);
        }

        logger.info(`Migration complete: ${migrated} migrated, ${skipped} skipped (already had roleId)`);
    } catch (error) {
        logger.error(`Error migrating admin roles: ${(error as Error).message}`);
    } finally {
        mongoose.connection.close();
        logger.info("Database connection closed");
    }
};

migrateAdminRoles();
