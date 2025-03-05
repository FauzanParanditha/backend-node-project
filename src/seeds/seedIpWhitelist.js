import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../application/db.js";
import logger from "../application/logger.js";
import Admin from "../models/adminModel.js";
import IPWhitelist from "../models/ipWhitelistModel.js";

dotenv.config();

const seedIpWhitelists = async () => {
    try {
        // Connect to MongoDB
        connectDB();

        // Clear existing admins
        await IPWhitelist.deleteMany();
        logger.info("Cleared existing ip whitelists");

        // Fetch an admin ID
        const admin = await Admin.findOne({ email: "fauzan@pandi.id" });
        if (!admin) {
            throw new Error("Admin not found. Seed admins first.");
        }

        // Seed ip whitelist data
        const ipWhitelistData = [
            {
                ipAddress: "::1",
                adminId: admin._id,
            },
        ];

        const ipWhitelists = await IPWhitelist.insertMany(ipWhitelistData);
        logger.info("Ip whitelist seeded successfully");

        return ipWhitelists;
    } catch (error) {
        logger.error(`Error seeding admins: ${error.message}`);
    } finally {
        mongoose.connection.close();
        logger.info("Database connection closed");
    }
};

seedIpWhitelists();
