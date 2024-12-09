import mongoose from "mongoose";
import { connectDB } from "../application/db.js";
import logger from "../application/logger.js";
import Admin from "../models/adminModel.js";
import dotenv from "dotenv";
import { doHash } from "../utils/helper.js";

dotenv.config();

const seedAdmins = async () => {
    try {
        // Connect to MongoDB
        connectDB();

        // Clear existing admins
        await Admin.deleteMany();
        logger.info("Cleared existing admins");

        const hashPassword = await doHash("Pandi@123", 12);
        // Seed admin data
        const adminData = [
            {
                fullName: "Super Admin",
                email: "fauzan@pandi.id",
                password: hashPassword,
            },
        ];

        const admins = await Admin.insertMany(adminData);
        logger.info("Admins seeded successfully");

        return admins;
    } catch (error) {
        logger.error(`Error seeding admins: ${error.message}`);
    } finally {
        mongoose.connection.close();
        logger.info("Database connection closed");
    }
};

seedAdmins();
