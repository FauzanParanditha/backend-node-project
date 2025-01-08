import request from "supertest";
import { closeMongo, setupMongo } from "../setup-test.js";
import { web } from "../../src/application/web.js";
import { registerAdmin } from "../../src/service/adminService.js";

describe("POST /adm/auth/login", () => {
    beforeAll(async () => {
        await setupMongo();
    });

    afterAll(async () => {
        await closeMongo();
    });

    it("should return 400 for invalid input", async () => {
        const res = await request(web).post("/adm/auth/login").send({ email: "", password: "" });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty("success", false);
        expect(res.body).toHaveProperty("message");
    });

    it("should login an admin successfully", async () => {
        await registerAdmin({
            email: "test@test.id",
            password: "Test@1234",
            fullName: "New Admin",
        });

        const res = await request(web).post("/adm/auth/login").send({
            email: "test@test.id",
            password: "Test@1234",
        });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("message", "Login successful");
        expect(res.body).toHaveProperty("token");
    });

    it("should return 404 if admin does not exists", async () => {
        const res = await request(web).post("/adm/auth/login").send({
            email: "existing@test.id",
            password: "Test@1234",
        });

        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveProperty("errors", "Admin does not exist!");
    });

    it("should return 400 if invalid credentials", async () => {
        const res = await request(web).post("/adm/auth/login").send({
            email: "test@test.id",
            password: "Test@12346",
        });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty("errors", "Invalid credentials!");
    });
});
