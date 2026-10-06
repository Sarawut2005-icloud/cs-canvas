import type { NextResponse } from "next/server";

/**
 * MJU SSO (sso.mju.ac.th) settings for the frontend — server-side only.
 *
 * The frontend only builds the sign-in / sign-out links; the authorization
 * code exchange happens in the Core API (POST /auth/mju/callback), so the
 * browser never talks to token.aspx and the code never reaches client JS.
 */
export const MJU_CLIENT_ID = process.env.MJU_CLIENT_ID ?? "";
const SIGNIN_URL =
  process.env.MJU_SSO_SIGNIN_URL ?? "https://sso.mju.ac.th/signin.aspx";
const SIGNOUT_URL =
  process.env.MJU_SSO_SIGNOUT_URL ?? "https://sso.mju.ac.th/signout.aspx";

/** Marks a session that was opened through MJU SSO (drives sign-out). */
export const AUTH_PROVIDER_COOKIE = "csmju_auth_provider";

/**
 * Set by GET /auth/mju/login, required by GET /auth/mju/signin: proof that
 * this browser started the sign-in before MJU sent it back with a code.
 * MJU SSO has no `state` parameter, so without it anyone could make a
 * victim's browser finish a sign-in with the attacker's code (login CSRF).
 * It also carries the `next` path across the round trip. SameSite=Lax is
 * sent on the top-level GET that sso.mju.ac.th redirects to.
 */
export const MJU_LOGIN_COOKIE = "csmju_mju_login";
const MJU_LOGIN_MAX_AGE_SEC = 10 * 60;
/** Cookie value when there is no `next` to return to. */
const NO_NEXT = "-";

export const mjuSsoEnabled = () => MJU_CLIENT_ID.length > 0;

/** `cid` is URL-encoded and comes from configuration only (no open redirect). */
export const mjuSignInUrl = () =>
  `${SIGNIN_URL}?cid=${encodeURIComponent(MJU_CLIENT_ID)}`;

export const mjuSignOutUrl = () =>
  `${SIGNOUT_URL}?cid=${encodeURIComponent(MJU_CLIENT_ID)}`;

/** Authorization code as MJU SSO issues it: 32 alphanumerics, nothing else. */
export const isMjuAuthorizationCode = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9]{32}$/.test(value);

/**
 * Starts the pending sign-in. `next` must already have passed
 * safeNextPath(); it is stored base64url-encoded so its `?`, `&` and `=`
 * survive the cookie untouched.
 */
export function setPendingMjuLogin(
  response: NextResponse,
  next: string | null,
) {
  const value = next ? Buffer.from(next).toString("base64url") : NO_NEXT;
  response.cookies.set(MJU_LOGIN_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/mju",
    maxAge: MJU_LOGIN_MAX_AGE_SEC,
  });
}

/** The pending sign-in is single-use: cleared on success and on failure. */
export function clearPendingMjuLogin(response: NextResponse) {
  response.cookies.set(MJU_LOGIN_COOKIE, "", { path: "/auth/mju", maxAge: 0 });
}

/**
 * The raw `next` stored by setPendingMjuLogin, or null. Callers still run
 * it through safeNextPath() before redirecting to it.
 */
export function pendingMjuNext(cookieValue: string): string | null {
  if (cookieValue === NO_NEXT) return null;
  try {
    return Buffer.from(cookieValue, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
