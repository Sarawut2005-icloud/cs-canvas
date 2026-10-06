export const ACCESS_TOKEN_COOKIE = "csmju_access_token";
export const REFRESH_TOKEN_COOKIE = "csmju_refresh_token";
/**
 * Present only when the user ticked "จดจำการเข้าสู่ระบบ". Without it the
 * session cookies carry no expiry, so the browser drops them when it closes.
 */
export const REMEMBER_COOKIE = "csmju_remember";

/** Roles issued by the Core API (`role.name` in the database). */
export type UserRole = "student" | "alumni" | "staff" | "lecturer" | "guest" | "admin";

/** Roles allowed into the backoffice. */
export const BACKOFFICE_ROLES: UserRole[] = ["admin", "staff", "lecturer"];

/**
 * Where a signed-in user lands when nothing asked for a specific page:
 * the backoffice for roles that manage the platform, the portal for everyone
 * else. The portal has no link into the backoffice, so sending an admin to
 * `/` would hide every management menu.
 */
export function homePathFor(role: UserRole | undefined): string {
  return role && BACKOFFICE_ROLES.includes(role) ? "/backoffice" : "/";
}

/** Shape of the RS256 access/refresh token the Core API signs. */
export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  sid: string;
  iss: string;
  aud: string;
  iat?: number;
  exp?: number;
};

export type SessionUser = {
  id: string;
  email: string;
  /** Display handle from the Core API (student code for MJU SSO accounts). */
  username?: string | null;
  role: UserRole;
  sessionId: string;
  /** GET /auth/me only: the current profile picture, if one was uploaded. */
  profileImageId?: string | null;
  /**
   * GET /auth/me only: whether the account has a Core Hub password. false →
   * an MJU SSO account that must set one (/account/password/setup) first.
   */
  hasPassword?: boolean;
  /**
   * GET /auth/me only: what the account may do — role permissions plus
   * per-account grants (e.g. subsystem:create). For hiding UI only; the
   * Core API checks every request itself.
   */
  permissions?: string[];
};

/**
 * Decodes a JWT payload without verifying the signature. Signature
 * verification happens on the backend for every API call; this is only used
 * to gate navigation (middleware, server components) and read display info.
 */
export function decodeJwtPayload(token: string): JwtPayload {
  const base64url = token.split(".")[1];
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  // atob is available in both the Edge runtime (middleware) and Node's global scope.
  const json = decodeURIComponent(
    atob(padded)
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  );
  return JSON.parse(json) as JwtPayload;
}

/** Same as `decodeJwtPayload` but returns null instead of throwing. */
export function safeDecodeJwtPayload(token: string): JwtPayload | null {
  try {
    return decodeJwtPayload(token);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = safeDecodeJwtPayload(token);
  if (!payload) return true;
  if (!payload.exp) return false;
  return Date.now() >= payload.exp * 1000;
}

/** Maps a decoded access token to the user shape the UI works with. */
export function userFromToken(token: string): SessionUser | null {
  const payload = safeDecodeJwtPayload(token);
  if (!payload) return null;
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    sessionId: payload.sid,
  };
}

const ROLE_LABELS: Record<UserRole, string> = {
  student: "นักศึกษา",
  alumni: "ศิษย์เก่า",
  staff: "เจ้าหน้าที่",
  lecturer: "อาจารย์",
  guest: "ผู้เยี่ยมชม",
  admin: "ผู้ดูแลระบบ",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] ?? role;
}

/** The part of the email before `@`, used as a display name. */
export function displayName(email: string): string {
  return email.split("@")[0];
}

/**
 * What to call the signed-in user: their username (the student code for
 * MJU SSO accounts) when the Core API has one, else the e-mail's local part.
 */
export function userHandle(user: Pick<SessionUser, "email" | "username">): string {
  return user.username?.trim() || displayName(user.email);
}

/** Two-letter avatar initials derived from the handle or email. */
export function initials(
  user: string | Pick<SessionUser, "email" | "username">,
): string {
  const handle = typeof user === "string" ? displayName(user) : userHandle(user);
  return handle.slice(0, 2).toUpperCase();
}

/**
 * Clears the session cookies. Returns the URL the browser must be sent to
 * next when the session was opened through MJU SSO (its central sign-out);
 * otherwise `null`, and callers navigate to `/` themselves.
 */
export async function logout(): Promise<string | null> {
  const res = await fetch("/api/auth/logout", { method: "POST" });
  const body = (await res.json().catch(() => null)) as {
    data?: { redirect?: string };
  } | null;
  return body?.data?.redirect ?? null;
}
