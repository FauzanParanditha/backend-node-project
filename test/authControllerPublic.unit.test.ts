import { beforeEach, describe, expect, it, vi } from "vitest";

const adminFindOne = vi.fn();
const userFindOne = vi.fn();
const sendVerificationCodeService = vi.fn();
const verifyVerificationCodeService = vi.fn();
const sendForgotPasswordService = vi.fn();
const verifyForgotPasswordCodeService = vi.fn();
const sendUserVerificationCodeService = vi.fn();
const verifyUserVerificationCodeService = vi.fn();
const sendUserForgotPasswordService = vi.fn();
const verifyUserForgotPasswordCodeService = vi.fn();

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

vi.mock("../src/service/authService.js", () => ({
    sendVerificationCodeService,
    verifyVerificationCodeService,
    sendForgotPasswordService,
    verifyForgotPasswordCodeService,
}));

vi.mock("../src/service/authServiceUser.js", () => ({
    sendVerificationCodeService: sendUserVerificationCodeService,
    verifyVerificationCodeService: verifyUserVerificationCodeService,
    sendForgotPasswordService: sendUserForgotPasswordService,
    verifyForgotPasswordCodeService: verifyUserForgotPasswordCodeService,
}));

vi.mock("../src/service/activityLogService.js", () => ({
    logActivity: vi.fn(),
}));

vi.mock("../src/service/discordService.js", () => ({
    sendAuthAlert: vi.fn(),
}));

vi.mock("../src/utils/activityActor.js", () => ({
    getAuthActivityActor: vi.fn(() => null),
    resolveActivityActor: vi.fn(() => null),
}));

const createRes = () => {
    const res: Record<string, unknown> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    res.cookie = vi.fn().mockReturnValue(res);
    res.clearCookie = vi.fn().mockReturnValue(res);
    return res as any;
};

describe("public auth controller responses", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it("masks verification send response for existing and missing accounts", async () => {
        const { sendVerificationCode } = await import("../src/controllers/authController.js");

        const existingReq = { body: { email: "known@test.com" }, ip: "127.0.0.1" } as any;
        const missingReq = { body: { email: "missing@test.com" }, ip: "127.0.0.1" } as any;
        const next = vi.fn();

        adminFindOne.mockResolvedValueOnce({ email: "known@test.com" });
        sendVerificationCodeService.mockResolvedValueOnce("Code sent successfully!");
        const existingRes = createRes();
        await sendVerificationCode(existingReq, existingRes, next);

        adminFindOne.mockResolvedValueOnce(null);
        userFindOne.mockResolvedValueOnce(null);
        const missingRes = createRes();
        await sendVerificationCode(missingReq, missingRes, next);

        expect(existingRes.status).toHaveBeenCalledWith(200);
        expect(missingRes.status).toHaveBeenCalledWith(200);
        expect(existingRes.json).toHaveBeenCalledWith({
            success: true,
            message: "If the account exists, a verification code will be sent.",
        });
        expect(missingRes.json).toHaveBeenCalledWith({
            success: true,
            message: "If the account exists, a verification code will be sent.",
        });
        expect(next).not.toHaveBeenCalled();
    });

    it("masks forgot-password send response for unknown email", async () => {
        const { sendForgotPassword } = await import("../src/controllers/authControllerUser.js");

        adminFindOne.mockResolvedValueOnce(null);
        userFindOne.mockResolvedValueOnce(null);

        const req = { body: { email: "missing@test.com" }, ip: "127.0.0.1" } as any;
        const res = createRes();
        const next = vi.fn();

        await sendForgotPassword(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: "If the account exists, a reset instruction will be sent.",
        });
        expect(next).not.toHaveBeenCalled();
    });

    it("masks verify response for invalid or unknown verification code", async () => {
        const { verifyVerificationCode } = await import("../src/controllers/authControllerUser.js");

        userFindOne.mockResolvedValueOnce(null);

        const req = {
            body: {
                email: "missing@test.com",
                provided_code: 123456,
            },
            ip: "127.0.0.1",
        } as any;
        const res = createRes();
        const next = vi.fn();

        await verifyVerificationCode(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            errors: "Invalid or expired code",
        });
        expect(next).not.toHaveBeenCalled();
    });
});
