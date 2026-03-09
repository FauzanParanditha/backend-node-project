import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { web } from "../src/application/web.js";
import Admin from "../src/models/adminModel.js";
import IPWhitelist from "../src/models/ipWhitelistModel.js";
import { clearDatabase, closeMongo, setupMongo } from "./setup-test.js";

describe("POST /api/v1/auth/login", () => {
    beforeAll(async () => {
        await setupMongo();

        // Seed an admin
        const hashedPassword = await bcrypt.hash("Admin@123", 10);
        const admin = await Admin.create({
            email: "admin@test.com",
            fullName: "Test Admin",
            password: hashedPassword,
            role: "admin",
            verified: true,
        });

        // Seed IP Whitelist for Supertest
        await IPWhitelist.insertMany([
            { ipAddress: "::ffff:127.0.0.1", description: "Localhost IPv4-mapped-IPv6", adminId: admin._id },
            { ipAddress: "::1", description: "Localhost IPv6", adminId: admin._id },
            { ipAddress: "127.0.0.1", description: "Localhost IPv4", adminId: admin._id },
        ]);
    });

    afterAll(async () => {
        await clearDatabase();
        await closeMongo();
    });

    it("should return 400 for invalid email format", async () => {
        const response = await request(web).post("/api/v1/auth/login").send({
            email: "invalid-email",
            password: "Admin@123",
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        // Expecting Joi validation error
        expect(response.body.message).toContain('"email" must be a valid email');
    });

    it("should return 400 for wrong password but correct format", async () => {
        const response = await request(web).post("/api/v1/auth/login").send({
            email: "admin@test.com",
            password: "WrongPassword@123",
        });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBe("Invalid email or password");
    });

    it("should login successfully and return a token", async () => {
        const response = await request(web).post("/api/v1/auth/login").send({
            email: "admin@test.com",
            password: "Admin@123",
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe("Login successful");
        expect(response.body.data).toHaveProperty("token");
        expect(response.body.data.role).toBe("admin");
        expect(response.body.data.email).toBe("admin@test.com");
    });
});
