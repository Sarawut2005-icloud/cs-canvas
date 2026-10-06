import { type NextRequest, type NextResponse } from "next/server";
import {
  BACKEND_URL,
  forwardedFor,
  setSessionCookies,
  type TokenPair,
} from "../../../lib/backend";
import { CORE_HUB_BLOCKED_NEXT, safeNextPath } from "../../../lib/next-path";
import { redirectToPath } from "../../../lib/redirect";
import {
  PASSWORD_SETUP_PATH,
  passwordSetupUrl,
} from "../../../lib/password-setup";
import { homePathFor, userFromToken } from "../../../lib/session";
import {
  AUTH_PROVIDER_COOKIE,
  MJU_LOGIN_COOKIE,
  clearPendingMjuLogin,
  isMjuAuthorizationCode,
  mjuSsoEnabled,
  pendingMjuNext,
} from "../../../lib/mju-sso";

/**
 * GET /auth/mju/signin?ac=<code> — where sso.mju.ac.th sends the browser
 * after a successful sign-in.
 *
 * The code is validated for shape only and handed to the Core API, which
 * exchanges it with token.aspx server-to-server and answers with a normal
 * Core Hub token pair. Nothing about the code is logged or echoed back.
 * Failures land on /login with a generic message.
 */
export async function GET(request: NextRequest) {
  if (!mjuSsoEnabled()) return failed("disabled");

  const code = request.nextUrl.searchParams.get("ac");
  if (!isMjuAuthorizationCode(code)) return failed("invalid");

  // No pending-login cookie: this browser did not start the sign-in here —
  // a link from elsewhere (login CSRF) or a sign-in begun on MJU's own
  // pages. The code is dropped unused and the sign-in starts over, so the
  // browser ends up signed in as its own MJU user, never as whoever
  // produced the code. MJU answers at once when its session is still open.
  const pending = request.cookies.get(MJU_LOGIN_COOKIE)?.value;
  if (pending === undefined) {
    return noStore(redirectToPath("/auth/mju/login", {}, 303));
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/auth/mju/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...forwardedFor(request.headers),
      },
      body: JSON.stringify({ code }),
      cache: "no-store",
    });
  } catch {
    return failed("unavailable");
  }

  const body = (await res.json().catch(() => null)) as
    | { success: true; data: TokenPair & { password_set?: boolean } }
    | { success: false }
    | null;

  if (!res.ok || !body?.success) return failed(failureReason(res.status));

  const user = userFromToken(body.data.access_token);
  if (!user) return failed("unavailable");

  // Back to where the sign-in started (checked again here, not only when it
  // was stored), else the role's home. 303: GET it, never replay this URL.
  // An account without a password sets one first and carries `next` along
  // — unless `next` already is the setup page ("ลืมรหัสผ่าน").
  const next = safeNextPath(pendingMjuNext(pending), CORE_HUB_BLOCKED_NEXT);
  const toSetup =
    body.data.password_set === false &&
    new URL(next ?? "/", "http://self.invalid").pathname !== PASSWORD_SETUP_PATH;
  const response = noStore(
    toSetup
      ? redirectToPath(passwordSetupUrl({ next }), {}, 303)
      : redirectToPath(next ?? homePathFor(user.role), {}, 303),
  );

  // SSO sessions end with the browser (no "remember me" choice was made).
  setSessionCookies(response, body.data, false);
  response.cookies.set(AUTH_PROVIDER_COOKIE, "mju", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  clearPendingMjuLogin(response);
  return response;
}

/** Core API status → the `?sso_error=` the login page turns into a message. */
function failureReason(status: number): string {
  if (status === 401) return "rejected"; // bad, used or expired code
  if (status === 403) return "not_registered"; // not in the registry / inactive
  if (status === 409) return "conflict"; // account linked to another MJU identity
  return "unavailable";
}

function failed(reason: string) {
  const response = noStore(
    redirectToPath("/login", { sso_error: reason }, 303),
  );
  clearPendingMjuLogin(response);
  return response;
}

// The URL that brought the browser here carried the code. The site-wide
// Referrer-Policy (strict-origin-when-cross-origin, next.config.ts) already
// keeps its path and query from other sites; this answer must not be cached.
function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
