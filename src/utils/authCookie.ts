import type { CookieOptions, Response } from "express";

// Name of the auth cookie. jwtUnified middleware reads req.cookies["Authorization"]
// and expects a "Bearer <token>" value.
export const AUTH_COOKIE_NAME = "Authorization";

// Shared cookie attributes so set and clear always match (a mismatch means
// clearCookie silently fails to remove the cookie).
//
// domain = COOKIE_DOMAIN (e.g. ".pandi.id") so the cookie is shared between the
// API host and the dashboard host (both under pandi.id) — lets the Next.js
// middleware read it for route protection.
// sameSite "lax" is enough for CSRF here: cross-site (third-party) requests do
// not send the cookie, while same-site dashboard -> api calls do.
const baseCookieOptions = (): CookieOptions => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
});

export const setAuthCookie = (res: Response, token: string, expiresInSeconds: number): void => {
    res.cookie(AUTH_COOKIE_NAME, "Bearer " + token, {
        ...baseCookieOptions(),
        expires: new Date(Date.now() + expiresInSeconds * 1000),
    });
};

export const clearAuthCookie = (res: Response): void => {
    // clearCookie must use the same domain/path/sameSite/secure to match.
    const { httpOnly, secure, sameSite, domain, path } = baseCookieOptions();
    res.clearCookie(AUTH_COOKIE_NAME, { httpOnly, secure, sameSite, domain, path });
};
