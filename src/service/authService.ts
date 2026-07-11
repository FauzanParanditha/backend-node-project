import crypto from "crypto";
import jwt from "jsonwebtoken";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
// Side-effect import: registers "Role" model with Mongoose so .populate("roleId") works
import "../models/roleModel.js";
import IPWhitelist from "../models/ipWhitelistModel.js";
import User from "../models/userModel.js";
import { compareDoHash, doHash, hmacProcess, normalizeIP, toObjectId } from "../utils/helper.js";
import { sendAccountLockAlert } from "./discordService.js";
import { generateForgotPasswordLink, sendForgotPasswordEmail, sendVerifiedEmail } from "./sendMail.js";

const VERIFICATION_CODE_TTL_MS = 5 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;
const VERIFICATION_LOCK_MS = 15 * 60 * 1000;
const FORGOT_PASSWORD_TTL_MS = 5 * 60 * 1000;
const MAX_FORGOT_PASSWORD_ATTEMPTS = 5;
const FORGOT_PASSWORD_LOCK_MS = 15 * 60 * 1000;

const generateVerificationCode = (): string => crypto.randomInt(100000, 1000000).toString();

const getVerificationLockMessage = (lockedUntil: number): string => {
    const retryAfterMinutes = Math.ceil((lockedUntil - Date.now()) / 60000);
    return `Too many invalid verification attempts. Request a new code in ${Math.max(retryAfterMinutes, 1)} minute(s).`;
};

const getForgotPasswordLockMessage = (lockedUntil: number): string => {
    const retryAfterMinutes = Math.ceil((lockedUntil - Date.now()) / 60000);
    return `Too many invalid reset attempts. Request a new reset code in ${Math.max(retryAfterMinutes, 1)} minute(s).`;
};

export const loginAdmin = async ({ email, password }: { email: string; password: string }) => {
    const sanitizedEmail = email.trim().toLowerCase();

    const existAdmin = await Admin.findOne({
        email: sanitizedEmail,
    }).select("+password").populate("roleId");

    if (!existAdmin) {
        throw new ResponseError(400, "Invalid email or password");
    }

    const isValidPassword = await compareDoHash(password, existAdmin.password as string);

    if (!isValidPassword) {
        throw new ResponseError(400, "Invalid email or password");
    }

    if (!existAdmin.verified) {
        throw new ResponseError(403, "Account not verified. Please verify your account first.");
    }

    const populatedRole = existAdmin.roleId as any;
    const roleName: string = populatedRole?.name ?? "admin";
    const token = jwt.sign(
        {
            adminId: String(existAdmin._id),
            email: existAdmin.email,
            verified: existAdmin.verified,
            roleId: String(existAdmin.roleId?._id ?? existAdmin.roleId),
            role: roleName,
        },
        process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY as string,
        {
            expiresIn: "1h",
            issuer: "dashboard.payhub.id",
            audience: "admin",
        },
    );

    return {
        token,
        adminId: existAdmin._id,
        email: existAdmin.email,
    };
};

// Constant-time guard: when no user/admin matches the supplied email we still
// burn approximately one bcrypt(cost=12) compare so the response time matches
// the path where the user exists and the password is just wrong. Without this,
// an attacker can enumerate which emails are registered by measuring timing
// (~5ms vs ~100ms). Lazy-initialized so we pay the one-time hash cost only
// on the first login attempt.
let DUMMY_BCRYPT_HASH: string | null = null;
const dummyTimingCompare = async (password: string): Promise<void> => {
    if (!DUMMY_BCRYPT_HASH) {
        DUMMY_BCRYPT_HASH = await doHash(crypto.randomBytes(16).toString("hex"), 12);
    }
    await compareDoHash(password, DUMMY_BCRYPT_HASH);
};

// ---------------------------------------------------------------------------
// Account-level lockout
// ---------------------------------------------------------------------------
// Tracks failed login attempts per account (keyed by the account document, not
// by IP). Complements the IP+email rate limiter: rate limiter blocks burst
// brute force from one IP; account lockout blocks distributed brute force
// where many IPs target one email.
//
// Tier thresholds (cumulative failures, lock duration in ms; null = permanent
// and requires manual unlock by an admin):
//   5  fails -> 15 minutes
//   10 fails ->  1 hour
//   20 fails -> permanent
const LOGIN_LOCK_TIERS: Array<{ attempts: number; lockMs: number | null }> = [
    { attempts: 5, lockMs: 15 * 60 * 1000 },
    { attempts: 10, lockMs: 60 * 60 * 1000 },
    { attempts: 20, lockMs: null },
];

interface LockableAccount {
    email?: string;
    loginAttempts?: number;
    loginLockedUntil?: number | null;
    save: () => Promise<unknown>;
}

// Permanent lock is stored as Number.MAX_SAFE_INTEGER so the standard
// "is now past lockedUntil?" check works without a separate boolean field.
// Anything realistic (Number.MAX_SAFE_INTEGER ms from epoch is the year 287,
// 396,341) will never expire in practice.
const PERMANENT_LOCK_MARKER = Number.MAX_SAFE_INTEGER;

const isPermanentLock = (until: number | null | undefined): boolean => until === PERMANENT_LOCK_MARKER;

const getLockMessageForUntil = (until: number): string => {
    if (isPermanentLock(until)) {
        return "Account is locked due to too many failed login attempts. Contact an administrator to unlock.";
    }
    const minutesLeft = Math.max(1, Math.ceil((until - Date.now()) / 60000));
    return `Account temporarily locked due to too many failed login attempts. Try again in ${minutesLeft} minute(s).`;
};

// Returns the new lockedUntil timestamp (ms) when the attempt count crosses
// a tier, or undefined if no tier crossed yet. Permanent lock uses
// PERMANENT_LOCK_MARKER.
const computeLockUntil = (attempts: number): number | undefined => {
    // Walk tiers from highest to lowest so 20+ resolves to permanent, etc.
    for (let i = LOGIN_LOCK_TIERS.length - 1; i >= 0; i--) {
        const tier = LOGIN_LOCK_TIERS[i];
        if (attempts >= tier.attempts) {
            return tier.lockMs === null ? PERMANENT_LOCK_MARKER : Date.now() + tier.lockMs;
        }
    }
    return undefined;
};

// Increment the failure counter on the account and persist a lock if a tier
// is reached. Fire-and-forget save errors are logged but never thrown so a DB
// hiccup cannot mask the original auth failure.
const incrementLoginFailure = async (
    account: LockableAccount,
    accountType: "admin" | "user",
): Promise<void> => {
    const prevLockedUntil = account.loginLockedUntil ?? null;
    const newAttempts = (account.loginAttempts ?? 0) + 1;
    account.loginAttempts = newAttempts;

    const lockUntil = computeLockUntil(newAttempts);
    if (lockUntil !== undefined) {
        account.loginLockedUntil = lockUntil;
    }

    try {
        await account.save();
    } catch (err) {
        logger.error(`Failed to persist login failure counter: ${(err as Error).message}`);
    }

    // Fire Discord alert only on a fresh lock transition (count crossed a
    // tier this call), not on every failed attempt against an already-locked
    // account.
    if (lockUntil !== undefined && prevLockedUntil !== lockUntil) {
        sendAccountLockAlert({
            accountType,
            email: account.email ?? "(unknown)",
            attempts: newAttempts,
            lockedUntil: lockUntil,
            permanent: isPermanentLock(lockUntil),
        }).catch((e) =>
            logger.error(`Failed to send account-lock Discord alert: ${(e as Error).message}`),
        );
    }
};

// Admin-callable: clear the failure counter and lock for an account by id.
// Used by the /admins/:id/unlock and /users/:id/unlock endpoints.
export const unlockAccount = async (
    accountType: "admin" | "user",
    id: string,
): Promise<{ email: string; previousAttempts: number; previousLockedUntil: number | null } | null> => {
    // Branches are kept separate so TypeScript can resolve the Mongoose
    // generics independently per model (the Admin and User schemas have
    // different shapes even though both expose loginAttempts/loginLockedUntil).
    const doc =
        accountType === "admin"
            ? await Admin.findById(id).select("+loginAttempts +loginLockedUntil")
            : await User.findById(id).select("+loginAttempts +loginLockedUntil");

    if (!doc) return null;

    const previousAttempts = doc.loginAttempts ?? 0;
    const previousLockedUntil = doc.loginLockedUntil ?? null;

    doc.loginAttempts = 0;
    doc.loginLockedUntil = null;
    await doc.save();

    return {
        email: doc.email,
        previousAttempts,
        previousLockedUntil,
    };
};

// Reset the failure counter and lock on successful login.
const clearLoginLock = async (account: LockableAccount): Promise<void> => {
    if ((account.loginAttempts ?? 0) === 0 && !account.loginLockedUntil) return;
    account.loginAttempts = 0;
    account.loginLockedUntil = null;
    try {
        await account.save();
    } catch (err) {
        logger.error(`Failed to reset login lock: ${(err as Error).message}`);
    }
};

// Returns the lockedUntil timestamp if the account is currently locked,
// otherwise null. Lazily unlocks an account whose timed lock has expired
// (counter is also reset on expiry so the user has a fresh budget).
const checkAndLazyUnlock = async (account: LockableAccount): Promise<number | null> => {
    const lockedUntil = account.loginLockedUntil ?? null;
    if (lockedUntil === null) return null;
    if (Date.now() < lockedUntil) return lockedUntil; // still locked
    // Lock has expired -> reset
    account.loginAttempts = 0;
    account.loginLockedUntil = null;
    try {
        await account.save();
    } catch (err) {
        logger.error(`Failed to clear expired login lock: ${(err as Error).message}`);
    }
    return null;
};

export const loginUnified = async ({
    email,
    password,
    clientIP,
}: {
    email: string;
    password: string;
    clientIP?: string;
}) => {
    const sanitizedEmail = email.trim().toLowerCase();

    const existAdmin = await Admin.findOne({
        email: sanitizedEmail,
    }).select("+password +loginAttempts +loginLockedUntil").populate("roleId");

    if (existAdmin) {
        if (!clientIP) throw new ResponseError(400, "Client IP not provided", "CLIENT_IP_MISSING");

        const normalizedIP = normalizeIP(clientIP);
        const whitelistedIP = await IPWhitelist.findOne({
            ipAddress: normalizedIP,
        });

        if (!whitelistedIP) {
            throw new ResponseError(403, "Access forbidden", "IP_NOT_WHITELISTED");
        }

        const isValidPassword = await compareDoHash(password, existAdmin.password as string);

        if (!isValidPassword) {
            // Wrong password: increment the per-account failure counter and
            // possibly lock. Still respond with INVALID_CREDENTIALS so an
            // attacker probing wrong passwords cannot distinguish locked
            // from unlocked accounts via the response code.
            await incrementLoginFailure(existAdmin, "admin");
            throw new ResponseError(400, "Invalid email or password", "INVALID_CREDENTIALS");
        }

        // Password is correct - now check the lock. Only legit credential
        // holders reach this branch, so revealing the lock here helps them
        // (wait or contact admin) without leaking lock state to attackers.
        const lockedUntil = await checkAndLazyUnlock(existAdmin);
        if (lockedUntil !== null) {
            throw new ResponseError(429, getLockMessageForUntil(lockedUntil), "ACCOUNT_LOCKED");
        }

        if (!existAdmin.verified) {
            throw new ResponseError(403, "Account not verified. Please verify your account first.", "ACCOUNT_NOT_VERIFIED");
        }

        // Successful login - reset the per-account failure counter so a
        // user who eventually got their password right doesn't carry stale
        // attempts forward.
        await clearLoginLock(existAdmin);

        const populatedRole = existAdmin.roleId as any;
        const role: string = populatedRole?.name ?? "admin";
        const token = jwt.sign(
            {
                adminId: String(existAdmin._id),
                email: existAdmin.email,
                verified: existAdmin.verified,
                roleId: String(existAdmin.roleId?._id ?? existAdmin.roleId),
                role,
            },
            process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY as string,
            {
                expiresIn: "1h",
                issuer: "dashboard.payhub.id",
                audience: "admin",
            },
        );

        return {
            role,
            token,
            adminId: existAdmin._id,
            email: existAdmin.email,
            expiresIn: 3600,
        };
    }

    const existUser = await User.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+password +loginAttempts +loginLockedUntil").populate("roleId");

    if (!existUser) {
        await dummyTimingCompare(password);
        throw new ResponseError(400, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    const isValidPassword = await compareDoHash(password, existUser.password as string);
    if (!isValidPassword) {
        await incrementLoginFailure(existUser, "user");
        throw new ResponseError(400, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    // Password correct - check lock before granting access.
    const userLockedUntil = await checkAndLazyUnlock(existUser);
    if (userLockedUntil !== null) {
        throw new ResponseError(429, getLockMessageForUntil(userLockedUntil), "ACCOUNT_LOCKED");
    }

    if (!existUser.verified) {
        throw new ResponseError(403, "Account not verified. Please verify your account first.", "ACCOUNT_NOT_VERIFIED");
    }

    await clearLoginLock(existUser);

    const populatedRole = existUser.roleId as any;
    const token = jwt.sign(
        {
            userId: existUser._id,
            email: existUser.email,
            verified: existUser.verified,
            roleId: populatedRole?._id ? String(populatedRole._id) : String(existUser.roleId),
            role: "user",
        },
        process.env.ACCESS_TOKEN_PRIVATE_KEY as string,
        { expiresIn: "2h" },
    );

    return {
        role: "user",
        token,
        userId: existUser._id,
        email: existUser.email,
        expiresIn: 7200,
    };
};

export const sendVerificationCodeService = async (email: string) => {
    const sanitizedEmail = email.trim();

    const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    if (existAdmin.verified) throw new ResponseError(400, "Admin is already verified!");

    if (
        existAdmin.verificationCodeLockedUntil &&
        Date.now() < existAdmin.verificationCodeLockedUntil
    ) {
        throw new ResponseError(429, getVerificationLockMessage(existAdmin.verificationCodeLockedUntil));
    }

    const codeValue = generateVerificationCode();
    await sendVerifiedEmail(codeValue, existAdmin.email, existAdmin.fullName);

    existAdmin.verificationCode = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE as string);
    existAdmin.verificationCodeValidation = Date.now();
    existAdmin.verificationCodeAttempts = 0;
    existAdmin.verificationCodeLockedUntil = undefined;
    await existAdmin.save();

    return "Code sent successfully!";
};

export const verifyVerificationCodeService = async ({ value }: { value: Record<string, any> }) => {
    const codeValue = value.provided_code.toString();
    const sanitizedEmail = value.email.trim();

    const existAdmin = await Admin.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+verificationCode +verificationCodeValidation +verificationCodeAttempts +verificationCodeLockedUntil");
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    if (existAdmin.verified) throw new ResponseError(400, "Admin is verified!");

    if (
        existAdmin.verificationCodeLockedUntil &&
        Date.now() < existAdmin.verificationCodeLockedUntil
    ) {
        throw new ResponseError(429, getVerificationLockMessage(existAdmin.verificationCodeLockedUntil));
    }

    if (!existAdmin.verificationCode || !existAdmin.verificationCodeValidation)
        throw new ResponseError(400, "Something is wrong with the code!");

    if (Date.now() - (existAdmin.verificationCodeValidation as number) > VERIFICATION_CODE_TTL_MS) {
        existAdmin.verificationCode = undefined;
        existAdmin.verificationCodeValidation = undefined;
        existAdmin.verificationCodeAttempts = 0;
        await existAdmin.save();
        throw new ResponseError(400, "Code has been expired!");
    }

    const hashedCodeValue = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE as string);

    if (hashedCodeValue !== existAdmin.verificationCode) {
        const attempts = (existAdmin.verificationCodeAttempts ?? 0) + 1;

        if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
            existAdmin.verificationCode = undefined;
            existAdmin.verificationCodeValidation = undefined;
            existAdmin.verificationCodeAttempts = 0;
            existAdmin.verificationCodeLockedUntil = Date.now() + VERIFICATION_LOCK_MS;
            await existAdmin.save();
            throw new ResponseError(429, getVerificationLockMessage(existAdmin.verificationCodeLockedUntil));
        }

        existAdmin.verificationCodeAttempts = attempts;
        await existAdmin.save();
        throw new ResponseError(400, "Invalid verification code");
    }

    existAdmin.verified = true;
    existAdmin.verifiedAt = new Date();
    existAdmin.verificationCode = undefined;
    existAdmin.verificationCodeValidation = undefined;
    existAdmin.verificationCodeAttempts = 0;
    existAdmin.verificationCodeLockedUntil = undefined;
    await existAdmin.save();

    return "successfully verified!";
};

export const changePasswordService = async ({ value }: { value: Record<string, any> }) => {
    if (!value.verified) throw new ResponseError(400, "Admin not verified!");

    const existAdmin = await Admin.findOne({ _id: toObjectId(value.adminId) }).select("+password");
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    const result = await compareDoHash(value.old_password, existAdmin.password as string);
    if (!result) throw new ResponseError(400, "Invalid credentials!");

    const hashedPassword = await doHash(value.new_password, 12);
    existAdmin.password = hashedPassword;
    await existAdmin.save();

    return "Successfuly change password!";
};

export const sendForgotPasswordService = async (email: string) => {
    const sanitizedEmail = email.trim();

    const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });
    if (!existAdmin) return "Send Email Reset Password Successfully";

    if (
        existAdmin.forgotPasswordCodeLockedUntil &&
        Date.now() < existAdmin.forgotPasswordCodeLockedUntil
    ) {
        throw new ResponseError(429, getForgotPasswordLockMessage(existAdmin.forgotPasswordCodeLockedUntil));
    }

    // Cryptographically secure 6-digit code (100000-999999). Math.random() is
    // predictable and could produce <5 digits — unsafe for a reset token.
    const codeValue = crypto.randomInt(100000, 1000000).toString();
    const url = generateForgotPasswordLink(existAdmin.email, codeValue);
    await sendForgotPasswordEmail(url, existAdmin.email, existAdmin.fullName);

    existAdmin.forgotPasswordCode = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE as string);
    existAdmin.forgotPasswordCodeValidation = Date.now();
    existAdmin.forgotPasswordCodeAttempts = 0;
    existAdmin.forgotPasswordCodeLockedUntil = undefined;
    await existAdmin.save();

    return "Send Email Reset Password Successfully";
};

export const verifyForgotPasswordCodeService = async ({ value }: { value: Record<string, any> }) => {
    const codeValue = value.provided_code.toString();
    const sanitizedEmail = value.email.trim();

    const existAdmin = await Admin.findOne({
        email: { $eq: sanitizedEmail },
    }).select("+forgotPasswordCode +forgotPasswordCodeValidation +forgotPasswordCodeAttempts +forgotPasswordCodeLockedUntil");
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    if (
        existAdmin.forgotPasswordCodeLockedUntil &&
        Date.now() < existAdmin.forgotPasswordCodeLockedUntil
    ) {
        throw new ResponseError(429, getForgotPasswordLockMessage(existAdmin.forgotPasswordCodeLockedUntil));
    }

    if (!existAdmin.forgotPasswordCode || !existAdmin.forgotPasswordCodeValidation)
        throw new ResponseError(400, "Something is wrong with the code!");

    if (Date.now() - (existAdmin.forgotPasswordCodeValidation as number) > FORGOT_PASSWORD_TTL_MS) {
        existAdmin.forgotPasswordCode = undefined;
        existAdmin.forgotPasswordCodeValidation = undefined;
        existAdmin.forgotPasswordCodeAttempts = 0;
        await existAdmin.save();
        throw new ResponseError(400, "Code has been expired!");
    }

    const hashedCodeValue = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE as string);

    if (hashedCodeValue !== existAdmin.forgotPasswordCode) {
        const attempts = (existAdmin.forgotPasswordCodeAttempts ?? 0) + 1;

        if (attempts >= MAX_FORGOT_PASSWORD_ATTEMPTS) {
            existAdmin.forgotPasswordCode = undefined;
            existAdmin.forgotPasswordCodeValidation = undefined;
            existAdmin.forgotPasswordCodeAttempts = 0;
            existAdmin.forgotPasswordCodeLockedUntil = Date.now() + FORGOT_PASSWORD_LOCK_MS;
            await existAdmin.save();
            throw new ResponseError(429, getForgotPasswordLockMessage(existAdmin.forgotPasswordCodeLockedUntil));
        }

        existAdmin.forgotPasswordCodeAttempts = attempts;
        await existAdmin.save();
        throw new ResponseError(400, "Invalid reset code");
    }

    const hashedPassword = await doHash(value.new_password, 12);
    existAdmin.password = hashedPassword;
    existAdmin.forgotPasswordCode = undefined;
    existAdmin.forgotPasswordCodeValidation = undefined;
    existAdmin.forgotPasswordCodeAttempts = 0;
    existAdmin.forgotPasswordCodeLockedUntil = undefined;
    await existAdmin.save();

    return "Successfully update password";
};
