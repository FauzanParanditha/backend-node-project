import Admin from "../../src/models/adminModel.js";
import { registerAdmin } from "../../src/service/adminService.js";
import { ResponseError } from "../../src/error/responseError.js";
import { closeMongo, setupMongo } from "../setup-test.js";

describe("registerAdmin", () => {
    beforeAll(async () => {
        await setupMongo();
    });

    afterAll(async () => {
        await closeMongo();
    });

    it("should throw error if admin already exists", async () => {
        await Admin.create({
            email: "existing@test.id",
            password: "hashedPassword",
            fullName: "Existing Admin",
        });

        await expect(
            registerAdmin({
                email: "existing@test.id",
                password: "Test@1234",
                fullName: "Test Admin",
            }),
        ).rejects.toThrowError(new ResponseError(400, "Admin already exists!"));
    });

    it("should register a new admin successfully", async () => {
        const result = await registerAdmin({
            email: "new@test.id",
            password: "Test@1234",
            fullName: "New Admin",
        });

        const admin = await Admin.findOne({ email: "new@test.id" });
        expect(admin).not.toBeNull();
        expect(admin.email).toBe("new@test.id");
        expect(admin.fullName).toBe("New Admin");
        expect(admin.password).not.toBe("Test@1234");
    });
});
