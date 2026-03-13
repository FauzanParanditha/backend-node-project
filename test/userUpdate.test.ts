import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_PERMISSIONS } from "../src/constants/permissions.js";
import { web } from "../src/application/web.js";
import Admin from "../src/models/adminModel.js";
import IPWhitelist from "../src/models/ipWhitelistModel.js";
import Role from "../src/models/roleModel.js";
import User from "../src/models/userModel.js";
import { clearDatabase, closeMongo, setupMongo } from "./setup-test.js";

vi.mock("../src/application/websocket_server.js", () => ({
    wss: null,
    getWebSocketServer: () => null,
    broadcastPaymentUpdate: vi.fn(),
}));

describe("PUT /api/v1/user/:id", () => {
    beforeAll(async () => {
        await setupMongo();
    });

    beforeEach(() => {
        process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY = "admin-secret";
    });

    afterEach(async () => {
        await clearDatabase();
    });

    afterAll(async () => {
        await closeMongo();
    });

    it("updates the user's roleId, email, verified status, and fullName", async () => {
        const adminRole = await Role.create({
            name: "admin",
            permissions: ALL_PERMISSIONS,
            isSystem: true,
        });
        const oldUserRole = await Role.create({
            name: "user_old",
            permissions: [],
        });
        const newUserRole = await Role.create({
            name: "user_new",
            permissions: [],
        });

        const admin = await Admin.create({
            email: "admin@test.com",
            fullName: "Admin",
            password: "hashed-password",
            roleId: adminRole._id,
            verified: true,
        });

        await IPWhitelist.insertMany([
            { ipAddress: "::ffff:127.0.0.1", description: "Localhost IPv4-mapped-IPv6", adminId: admin._id },
            { ipAddress: "::1", description: "Localhost IPv6", adminId: admin._id },
            { ipAddress: "127.0.0.1", description: "Localhost IPv4", adminId: admin._id },
        ]);

        const user = await User.create({
            email: "old@test.com",
            fullName: "Old Name",
            password: "hashed-password",
            roleId: oldUserRole._id,
            verified: false,
        });

        const token = jwt.sign(
            {
                adminId: String(admin._id),
                email: admin.email,
                verified: true,
                roleId: String(adminRole._id),
                role: "admin",
            },
            process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY as string,
        );

        const response = await request(web).put(`/api/v1/user/${user._id}`).set("Authorization", `Bearer ${token}`).send({
            fullName: "Fauzan Paranditha",
            email: "paranditha@gmail.com",
            roleId: String(newUserRole._id),
            verified: true,
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const updatedUser = await User.findById(user._id);
        expect(updatedUser?.fullName).toBe("Fauzan Paranditha");
        expect(updatedUser?.email).toBe("paranditha@gmail.com");
        expect(String(updatedUser?.roleId)).toBe(String(newUserRole._id));
        expect(updatedUser?.verified).toBe(true);
    });
});
