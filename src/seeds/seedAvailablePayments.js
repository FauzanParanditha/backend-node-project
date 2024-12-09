import mongoose from "mongoose";
import { connectDB } from "../application/db.js";
import AvailablePayment from "../models/availablePaymentModel.js";
import logger from "../application/logger.js";
import Admin from "../models/adminModel.js";
import dotenv from "dotenv";

dotenv.config();

const seedAvailablePayments = async () => {
    try {
        // Connect to MongoDB
        connectDB();

        // Clear existing available payments
        await AvailablePayment.deleteMany();
        logger.info("Cleared existing available payments");

        // Fetch an admin ID
        const admin = await Admin.findOne({ email: "fauzan@pandi.id" });
        if (!admin) {
            throw new Error("Admin not found. Seed admins first.");
        }

        // Seed available payment data
        const seedData = [
            {
                name: "Qris",
                active: true,
                image: "public/payment/qris.svg",
                category: "QRIS",
                adminId: admin._id,
            },
            {
                name: "BCAVA",
                active: true,
                image: "public/payment/bcava.svg",
                category: "VIRTUAL ACCOUNT",
                adminId: admin._id,
            },
            {
                name: "BNIVA",
                active: true,
                image: "public/payment/bniva.svg",
                category: "VIRTUAL ACCOUNT",
                adminId: admin._id,
            },
            {
                name: "PermataVA",
                active: true,
                image: "public/payment/permatava.svg",
                category: "VIRTUAL ACCOUNT",
                adminId: admin._id,
            },
            {
                name: "BRIVA",
                active: true,
                image: "public/payment/briva.svg",
                category: "VIRTUAL ACCOUNT",
                adminId: admin._id,
            },
            {
                name: "MandiriVA",
                active: true,
                image: "public/payment/mandiriva.svg",
                category: "VIRTUAL ACCOUNT",
                adminId: admin._id,
            },
        ];

        await AvailablePayment.insertMany(seedData);
        logger.info("Available payments seeded successfully");
    } catch (error) {
        logger.error("Error seeding available payments:", error);
    } finally {
        mongoose.connection.close();
        logger.info("Database connection closed");
    }
};

// Run the seed function
seedAvailablePayments();
