import mongoose from "mongoose";
import { connectDB } from "../application/db.js";
import logger from "../application/logger.js";
import Role from "../models/roleModel.js";
import { DEFAULT_ROLE_PERMISSIONS } from "../constants/permissions.js";
import dotenv from "dotenv";

dotenv.config();

const seedRoles = async () => {
    try {
        connectDB();

        const roles = [
            {
                name: "super_admin",
                description: "Full access to all features including role management",
                permissions: DEFAULT_ROLE_PERMISSIONS.super_admin,
                isSystem: true,
            },
            {
                name: "admin",
                description: "Full access to all features except role management",
                permissions: DEFAULT_ROLE_PERMISSIONS.admin,
                isSystem: true,
            },
            {
                name: "finance",
                description: "Read-only access to dashboard, orders, and logs",
                permissions: DEFAULT_ROLE_PERMISSIONS.finance,
                isSystem: true,
            },
            {
                name: "user",
                description: "Scoped access to own clients, orders, client keys, and dashboard",
                permissions: DEFAULT_ROLE_PERMISSIONS.user,
                isSystem: true,
            },
            {
                name: "client",
                description: "Read-only access to own orders and client data (API partner)",
                permissions: DEFAULT_ROLE_PERMISSIONS.client,
                isSystem: true,
            },
        ];

        for (const roleData of roles) {
            const existing = await Role.findOne({ name: roleData.name });
            if (existing) {
                // Update permissions if the role already exists (in case new permissions were added)
                existing.permissions = roleData.permissions;
                existing.description = roleData.description;
                existing.isSystem = roleData.isSystem;
                await existing.save();
                logger.info(`Role "${roleData.name}" updated`);
            } else {
                await Role.create(roleData);
                logger.info(`Role "${roleData.name}" created`);
            }
        }

        logger.info("Roles seeded successfully");
    } catch (error) {
        logger.error(`Error seeding roles: ${(error as Error).message}`);
    } finally {
        mongoose.connection.close();
        logger.info("Database connection closed");
    }
};

seedRoles();
