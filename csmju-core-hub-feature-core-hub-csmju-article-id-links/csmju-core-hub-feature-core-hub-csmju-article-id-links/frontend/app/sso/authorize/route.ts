import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "../../lib/session";
import {
  BACKEND_URL,
  clearSessionCookies,
  forwardedFor,
} from "../../lib/backend";
import { redirectToPath } from "../../lib/redirect";

/**
 * Browser entry point for Central SSO:
 *   GET /sso/authorize?subsystem=<name>[&state=<state>]
 *
 * A subsystem's own GET /auth/login sends the browser here with a `state` it
 * minted; a sidebar click arrives without one. Either way the browser cannot
 * attach `Authorization: Bearer` to a redirect, and the Core API's
 * /auth/sso/* endpoints require exactly that — so this route reads the
 * httpOnly session cookie, asks the API for the handoff, and redirects to the
 * callback_url the registry holds for that subsystem.
 *
 * It lives outside /api on purpose: proxy.ts only runs for non-/api paths,
 * and proxy.ts is what rotates an expired access token (and sends an
 * anonymous visitor to /login and back) before this handler runs.
 *
 * `state` is passed through untouched and never invented here. Only the
 * subsystem that minted it can tell whether a callback belongs to a sign-in
 * it started; a state made up by Core Hub would defeat that check.
 */

const SUBSYSTEM_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Codes /sso/error knows how to explain. */
type SsoErrorCode =
  | "bad_request"
  | "forbidden"
  | "not_found"
  | "not_available"
  | "unavailable"
  | "failed";

type HandoffBody =
  | { success: true; data: { redirect_url?: unknown } }
  | { success: false }
  | null;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const subsystem = params.get("subsystem") ?? "";
  const state = params.get("state");
  const here = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (subsystem.length > 64 || !SUBSYSTEM_NAME.test(subsystem)) {
    return ssoError("bad_request", "");
  }

  if (state !== null && (state.length === 0 || state.length > 512)) {
    return ssoError("bad_request", subsystem);
  }

  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;

  // proxy.ts should already have sent an anonymous visitor to /login.
  if (!token) return toLogin(here);

  const handoff = new URL(`${BACKEND_URL}/auth/sso/handoff`);
  handoff.searchParams.set("subsystem", subsystem);
  if (state !== null) handoff.searchParams.set("state", state);

  let res: Response;
  try {
    res = await fetch(handoff, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...forwardedFor(request.headers),
      },
      cache: "no-store",
    });
  } catch {
    return ssoError("unavailable", subsystem);
  }

  if (res.status === 401) {
    // The API refused a token that still looks valid here — the session was
    // revoked. The cookies must go with this redirect: proxy.ts judges them
    // by `exp` alone, so it would treat the user as signed in, send /login
    // straight back to `next`, and loop between here and /login for good.
    return clearSessionCookies(toLogin(here));
  }

  if (res.status === 403) return ssoError("forbidden", subsystem);
  if (res.status === 404) return ssoError("not_found", subsystem);
  if (res.status === 409) return ssoError("not_available", subsystem);

  const body = (await res.json().catch(() => null)) as HandoffBody;
  const redirectUrl =
    res.ok && body?.success ? parseHttpUrl(body.data.redirect_url) : null;

  if (!redirectUrl) return ssoError("failed", subsystem);

  // The API built this from the registered callback_url, so it is followed
  // as is. It carries the access token: never log it.
  return noStore(NextResponse.redirect(redirectUrl, 302));
}

/** 302 to /sso/error. The page owns every message; the query only names it. */
function ssoError(code: SsoErrorCode, subsystem: string) {
  return noStore(
    redirectToPath("/sso/error", subsystem ? { code, subsystem } : { code }),
  );
}

/** 302 to /login, coming back here — query included — once signed in. */
function toLogin(here: string) {
  return noStore(redirectToPath("/login", { next: here }));
}

/**
 * Nothing on this route may be cached, and the Referer must not leak the
 * token-bearing callback URL to whatever the subsystem loads next.
 */
function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function parseHttpUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
