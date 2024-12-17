import mongoose from "mongoose";
import { connectDB } from "../application/db.js";
import logger from "../application/logger.js";
import dotenv from "dotenv";
import Client from "../models/clientModel.js";
import Admin from "../models/adminModel.js";

dotenv.config();

const seedClients = async () => {
    try {
        // Connect to MongoDB
        connectDB();

        // Clear existing clients
        await Client.deleteMany();
        logger.info("Cleared existing clients");

        // Fetch an admin ID
        const admin = await Admin.findOne({ email: "fauzan@pandi.id" });
        if (!admin) {
            throw new Error("Admin not found. Seed admins first.");
        }

        // Seed client data
        const clientData = [
            {
                name: "APPS 1",
                active: true,
                clientId: "CLNT-12345",
                notifyUrl: "http://localhost:5000/callback",
                adminId: admin._id,
            },
        ];

        const clients = await Client.insertMany(clientData);
        logger.info("Clients seeded successfully");

        return clients;
    } catch (error) {
        logger.error(`Error seeding clients: ${error.message}`);
    } finally {
        mongoose.connection.close();
        logger.info("Database connection closed");
    }
};

seedClients();
