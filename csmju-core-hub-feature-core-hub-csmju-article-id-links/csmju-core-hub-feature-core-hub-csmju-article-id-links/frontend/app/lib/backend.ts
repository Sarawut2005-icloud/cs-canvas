import type { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REMEMBER_COOKIE,
  safeDecodeJwtPayload,
} from "./session";

/**
 * Base URL of the NestJS Core API. Edge-runtime safe: this module must not
 * import `next/headers`, because middleware depends on it.
 */
export const BACKEND_URL =
  process.env.BACKEND_API_URL ?? "http://127.0.0.1:3000/api/v1";

/**
 * Passes on the X-Forwarded-For this web server received, so the Core API
 * sees the user's address instead of this server's. Without it every request
 * the web makes arrives from one IP, and the API's per-IP rate limit would
 * count the whole university as a single client.
 *
 * The API only trusts the header from proxies listed in its TRUST_PROXY, so
 * forwarding a value a caller forged cannot make the API believe it. Takes
 * `Headers` rather than calling `next/headers`, which middleware cannot use.
 */
export function forwardedFor(headers: Headers): Record<string, string> {
  const value = headers.get("x-forwarded-for");
  return value ? { "X-Forwarded-For": value } : {};
}

/** Token pair as the Core API returns it (`snake_case`). */
export type TokenPair = {
  access_token: string;
  refresh_token: string;
};

async function requestRefresh(
  refreshToken: string,
  incoming?: Headers,
): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(incoming ? forwardedFor(incoming) : {}),
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });

    const body = await res.json().catch(() => null);

    if (!res.ok || !body?.success) return null;

    return body.data as TokenPair;
  } catch {
    return null;
  }
}

/**
 * The Core API rotates refresh tokens and treats a replayed one as theft:
 * `AuthService.refresh` revokes the whole session when the incoming hash no
 * longer matches the stored one. A single navigation can produce several
 * concurrent requests (RSC prefetches, parallel segments, a second tab), all
 * carrying the same expired access cookie — so we collapse them onto one
 * rotation and hand every caller the same result.
 */
const inFlight = new Map<string, Promise<TokenPair | null>>();
const settled = new Map<string, { tokens: TokenPair | null; at: number }>();

/** How long a rotation result answers for the token it consumed. */
const SETTLED_TTL_MS = 15_000;

/**
 * POST /auth/refresh — rotates the refresh token. Returns null when the
 * session was revoked, expired or the token was already used.
 *
 * `incoming` is the browser request's headers, for `forwardedFor`. Callers
 * that share one rotation share the first caller's address, which is the
 * same user anyway.
 */
export function refreshTokens(
  refreshToken: string,
  incoming?: Headers,
): Promise<TokenPair | null> {
  const recent = settled.get(refreshToken);

  if (recent && Date.now() - recent.at < SETTLED_TTL_MS) {
    return Promise.resolve(recent.tokens);
  }

  const running = inFlight.get(refreshToken);

  if (running) return running;

  const rotation = requestRefresh(refreshToken, incoming)
    .then((tokens) => {
      settled.set(refreshToken, { tokens, at: Date.now() });
      // Only the losers of a race read this entry; drop it soon after.
      setTimeout(() => settled.delete(refreshToken), SETTLED_TTL_MS).unref?.();
      return tokens;
    })
    .finally(() => {
      inFlight.delete(refreshToken);
    });

  inFlight.set(refreshToken, rotation);

  return rotation;
}

/**
 * Stores both tokens as httpOnly cookies.
 *
 * `remember` — the "จดจำการเข้าสู่ระบบ" tick — decides how long they live:
 * ticked, each cookie expires with its token's `exp` (the refresh token keeps
 * the user signed in across browser restarts); not ticked, they are session
 * cookies the browser drops when it closes. Token rotation passes the same
 * choice along, read back from `REMEMBER_COOKIE`.
 */
export function setSessionCookies(
  response: NextResponse,
  tokens: TokenPair,
  remember: boolean,
) {
  const secure = process.env.NODE_ENV === "production";
  const pairs = [
    [ACCESS_TOKEN_COOKIE, tokens.access_token],
    [REFRESH_TOKEN_COOKIE, tokens.refresh_token],
  ] as const;
  const expiresAt = (token: string) => {
    const exp = safeDecodeJwtPayload(token)?.exp;
    return remember && exp ? new Date(exp * 1000) : undefined;
  };

  for (const [name, token] of pairs) {
    response.cookies.set(name, token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      expires: expiresAt(token),
    });
  }

  if (remember) {
    response.cookies.set(REMEMBER_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      expires: expiresAt(tokens.refresh_token),
    });
  } else {
    response.cookies.delete(REMEMBER_COOKIE);
  }

  return response;
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  response.cookies.delete(REMEMBER_COOKIE);
  return response;
}
