import { beforeEach, describe, expect, it, vi } from "vitest";

const adminFindOne = vi.fn();
const userFindOne = vi.fn();
const ipWhitelistFindOne = vi.fn();
const compareDoHash = vi.fn();
const hmacProcess = vi.fn();

vi.mock("../src/models/adminModel.js", () => ({
    default: {
        findOne: adminFindOne,
    },
}));

vi.mock("../src/models/userModel.js", () => ({
    default: {
        findOne: userFindOne,
    },
}));

vi.mock("../src/models/ipWhitelistModel.js", () => ({
    default: {
        findOne: ipWhitelistFindOne,
    },
}));

vi.mock("../src/utils/helper.js", () => ({
    compareDoHash,
    doHash: vi.fn(),
    hmacProcess,
    normalizeIP: vi.fn((ip: string) => ip),
}));

vi.mock("../src/service/sendMail.js", () => ({
    generateForgotPasswordLink: vi.fn(() => "https://example.test/reset"),
    sendForgotPasswordEmail: vi.fn(),
    sendVerifiedEmail: vi.fn(),
}));

const createQuery = <T>(result: T) => ({
    select: vi.fn().mockResolvedValue(result),
});

describe("auth service security", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY = "admin-secret";
        process.env.ACCESS_TOKEN_PRIVATE_KEY = "user-secret";
        process.env.HMAC_VERIFICATION_CODE = "verification-secret";
    });

    it("rejects admin login when account is not verified", async () => {
        adminFindOne.mockReturnValueOnce(
            createQuery({
                _id: "admin-1",
                email: "admin@test.com",
                password: "hashed-password",
                verified: false,
                role: "admin",
            }),
        );
        ipWhitelistFindOne.mockResolvedValue({ ipAddress: "127.0.0.1" });
        compareDoHash.mockResolvedValue(true);

        const { loginUnified } = await import("../src/service/authService.js");

        await expect(
            loginUnified({
                email: "admin@test.com",
                password: "Admin@123",
                clientIP: "127.0.0.1",
            }),
        ).rejects.toMatchObject({
            status: 403,
            message: "Account not verified. Please verify your account first.",
        });
    });

    it("rejects user login when account is not verified", async () => {
        adminFindOne.mockReturnValueOnce(createQuery(null));
        userFindOne.mockReturnValueOnce(
            createQuery({
                _id: "user-1",
                email: "user@test.com",
                password: "hashed-password",
                verified: false,
            }),
        );
        compareDoHash.mockResolvedValue(true);

        const { loginUnified } = await import("../src/service/authService.js");

        await expect(
            loginUnified({
                email: "user@test.com",
                password: "User@123",
                clientIP: "127.0.0.1",
            }),
        ).rejects.toMatchObject({
            status: 403,
            message: "Account not verified. Please verify your account first.",
        });
    });

    it("locks verification code after repeated invalid attempts", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const existingUser = {
            email: "user@test.com",
            verified: false,
            verificationCode: "stored-hash",
            verificationCodeValidation: Date.now(),
            verificationCodeAttempts: 4,
            verificationCodeLockedUntil: undefined,
            save,
        };

        userFindOne.mockReturnValueOnce(createQuery(existingUser));
        hmacProcess.mockReturnValue("different-hash");

        const { verifyVerificationCodeService } = await import("../src/service/authServiceUser.js");

        await expect(
            verifyVerificationCodeService({
                value: {
                    email: "user@test.com",
                    provided_code: 123456,
                },
            }),
        ).rejects.toMatchObject({
            status: 429,
        });

        expect(existingUser.verificationCode).toBeUndefined();
        expect(existingUser.verificationCodeValidation).toBeUndefined();
        expect(existingUser.verificationCodeAttempts).toBe(0);
        expect(existingUser.verificationCodeLockedUntil).toEqual(expect.any(Number));
        expect(save).toHaveBeenCalled();
    });

    it("locks forgot-password code after repeated invalid attempts", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const existingUser = {
            email: "user@test.com",
            forgotPasswordCode: "stored-hash",
            forgotPasswordCodeValidation: Date.now(),
            forgotPasswordCodeAttempts: 4,
            forgotPasswordCodeLockedUntil: undefined,
            save,
        };

        userFindOne.mockReturnValueOnce(createQuery(existingUser));
        hmacProcess.mockReturnValue("different-hash");

        const { verifyForgotPasswordCodeService } = await import("../src/service/authServiceUser.js");

        await expect(
            verifyForgotPasswordCodeService({
                value: {
                    email: "user@test.com",
                    provided_code: 123456,
                    new_password: "User@1234",
                },
            }),
        ).rejects.toMatchObject({
            status: 429,
        });

        expect(existingUser.forgotPasswordCode).toBeUndefined();
        expect(existingUser.forgotPasswordCodeValidation).toBeUndefined();
        expect(existingUser.forgotPasswordCodeAttempts).toBe(0);
        expect(existingUser.forgotPasswordCodeLockedUntil).toEqual(expect.any(Number));
        expect(save).toHaveBeenCalled();
    });
});
