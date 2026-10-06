import { NextResponse, type NextRequest } from "next/server";
import { CORE_HUB_BLOCKED_NEXT, safeNextPath } from "../../../lib/next-path";
import {
  mjuSignInUrl,
  mjuSsoEnabled,
  setPendingMjuLogin,
} from "../../../lib/mju-sso";

/**
 * GET /auth/mju/login[?next=<path>] — sends the browser to MJU SSO. After
 * sign-in, MJU redirects to the callback registered for our client ID
 * (/auth/mju/signin).
 *
 * The pending-login cookie set here is what /auth/mju/signin checks before
 * it exchanges a code, and it carries `next` — e.g. the /sso/authorize URL
 * of a subsystem that sent the user to sign in — across the round trip.
 */
export function GET(request: NextRequest) {
  if (!mjuSsoEnabled()) {
    return new NextResponse("MJU SSO is not enabled on this server", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const next = safeNextPath(
    request.nextUrl.searchParams.get("next"),
    CORE_HUB_BLOCKED_NEXT,
  );

  // An absolute URL is right here: the target is sso.mju.ac.th, not this site.
  const response = NextResponse.redirect(mjuSignInUrl(), {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
  setPendingMjuLogin(response, next);
  return response;
}
