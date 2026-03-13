import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "../src/constants/permissions.js";
import Admin from "../src/models/adminModel.js";
import Role from "../src/models/roleModel.js";
import User from "../src/models/userModel.js";
import { clearDatabase, closeMongo, setupMongo } from "./setup-test.js";

vi.mock("../src/application/websocket_server.js", () => ({
    wss: null,
    getWebSocketServer: () => null,
    broadcastPaymentUpdate: vi.fn(),
}));

describe("GET /me", () => {
    let web: typeof import("../src/application/web.js").web;

    beforeAll(async () => {
        await setupMongo();
        ({ web } = await import("../src/application/web.js"));
    });

    beforeEach(() => {
        process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY = "admin-secret";
        process.env.ACCESS_TOKEN_PRIVATE_KEY = "user-secret";
    });

    afterEach(async () => {
        await clearDatabase();
    });

    afterAll(async () => {
        await closeMongo();
    });

    it("returns admin permissions from the assigned role", async () => {
        const role = await Role.create({
            name: "finance",
            permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.ORDER_LIST],
            isSystem: true,
        });

        const admin = await Admin.create({
            email: "finance@test.com",
            fullName: "Finance Admin",
            password: "hashed-password",
            roleId: role._id,
            verified: true,
        });

        const token = jwt.sign(
            {
                adminId: String(admin._id),
                email: admin.email,
                verified: admin.verified,
                roleId: String(role._id),
                role: "finance",
            },
            process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY as string,
        );

        const response = await request(web).get("/me").set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.role).toBe("finance");
        expect(response.body.data.permissions).toEqual([PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.ORDER_LIST]);
        expect(response.body.data.roleName).toBe("finance");
        expect(response.body.data.roleId).toBe(String(role._id));
    });

    it("returns user permissions from the assigned role", async () => {
        const role = await Role.create({
            name: "user",
            permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.CLIENT_READ],
            isSystem: true,
        });

        const user = await User.create({
            email: "user@test.com",
            fullName: "Regular User",
            password: "hashed-password",
            roleId: role._id,
            verified: true,
        });

        const token = jwt.sign(
            {
                userId: String(user._id),
                email: user.email,
                verified: user.verified,
                roleId: String(role._id),
                role: "user",
            },
            process.env.ACCESS_TOKEN_PRIVATE_KEY as string,
        );

        const response = await request(web).get("/me").set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.role).toBe("user");
        expect(response.body.data.permissions).toEqual([PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.CLIENT_READ]);
        expect(response.body.data.roleName).toBe("user");
        expect(response.body.data.roleId).toBe(String(role._id));
    });
});
