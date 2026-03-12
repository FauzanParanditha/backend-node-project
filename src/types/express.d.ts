import type { JwtPayload } from "jsonwebtoken";

/**
 * PaymentPartner represents the client document attached by verifyMiddleware.
 * Centralized here to avoid duplication across 6+ service files.
 */
export interface PaymentPartner {
    clientId: string;
    name: string;
    [key: string]: unknown; // Allow extra Mongoose fields
}

/**
 * Admin payload decoded from JWT by jwtMiddlewareAdmin.
 */
export interface AdminPayload extends JwtPayload {
    adminId: string;
    email: string;
    verified: boolean;
    /** Role ObjectId referencing the Role collection */
    roleId: string;
    /** @deprecated Legacy role string — kept for backward compatibility during migration */
    role?: string;
}

/**
 * User payload decoded from JWT by jwtMiddleware.
 */
export interface UserPayload extends JwtPayload {
    userId: string;
    email: string;
    verified: boolean;
}

/**
 * Unified auth payload decoded from JWT by jwtUnifiedMiddleware.
 * Can represent either admin or user, distinguished by `role`.
 */
export interface AuthPayload extends JwtPayload {
    adminId?: string;
    userId?: string;
    email: string;
    verified: boolean;
    /** Role ObjectId referencing the Role collection (admin/finance only) */
    roleId?: string;
    /** @deprecated Legacy role string — kept for backward compatibility during migration */
    role?: string;
}

declare global {
    namespace Express {
        interface Request {
            /** Set by jwtMiddlewareAdmin — guaranteed present after middleware */
            admin?: AdminPayload;
            /** Set by jwtMiddleware — guaranteed present after middleware */
            user?: UserPayload;
            /** Set by jwtUnifiedMiddleware — guaranteed present after middleware */
            auth?: AuthPayload;
            /** Set by jwtMiddlewareVerify — the matched Client document */
            partnerId?: PaymentPartner;
            /** Set by requirePermission — resolved permissions for the current role */
            permissions?: string[];
        }
    }
}

export {};
