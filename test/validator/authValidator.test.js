import { registerSchema } from "../../src/validators/authValidator.js";

describe("registerSchema", () => {
    it("should validate correctly for valid data", () => {
        const validData = {
            email: "test@test.id",
            password: "Test@1234",
            fullName: "Test Admin",
        };

        const { error } = registerSchema.validate(validData);
        expect(error).toBeUndefined(); // No validation errors
    });

    it("should return error for invalid email", () => {
        const invalidData = {
            email: "invalid-email",
            password: "Test@1234",
            fullName: "Test Admin",
        };

        const { error } = registerSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('"email" must be a valid email');
    });

    it("should return error for missing password", () => {
        const invalidData = {
            email: "test@test.id",
            fullName: "Test Admin",
        };

        const { error } = registerSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('"password" is required');
    });

    it("should return error for password not meeting complexity requirements", () => {
        const invalidData = {
            email: "test@test.id",
            password: "12345678",
            fullName: "Test Admin",
        };

        const { error } = registerSchema.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toBe(
            '"password" with value "12345678" fails to match the required pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,}$/',
        );
    });
});
