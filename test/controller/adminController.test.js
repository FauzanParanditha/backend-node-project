import request from "supertest";
import { web } from "../../src/application/web.js";
import Admin from "../../src/models/adminModel.js";
import { closeMongo, setupMongo } from "../setup-test.js";

describe("POST /api/adm/register", () => {
    beforeAll(async () => {
        await setupMongo();
    });

    afterAll(async () => {
        await closeMongo();
    });

    it("should return 400 for invalid input", async () => {
        const res = await request(web).post("/api/adm/register").send({ email: "", password: "", fullName: "" });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty("message");
    });

    it("should register an admin successfully", async () => {
        const res = await request(web).post("/api/adm/register").send({
            email: "test@test.id",
            password: "Test@1234",
            fullName: "Test Admin",
        });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("message", "Registered successfully");

        const admin = await Admin.findOne({ email: "test@test.id" });
        expect(admin).not.toBeNull();
        expect(admin.email).toBe("test@test.id");
    });

    it("should return 400 if admin already exists", async () => {
        await Admin.create({
            email: "existing@test.id",
            password: "Test@1234",
            fullName: "Existing Admin",
        });

        const res = await request(web).post("/api/adm/register").send({
            email: "existing@test.id",
            password: "Test@1234",
            fullName: "Existing Admin",
        });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty("errors", "Admin already exists!");
    });
});
