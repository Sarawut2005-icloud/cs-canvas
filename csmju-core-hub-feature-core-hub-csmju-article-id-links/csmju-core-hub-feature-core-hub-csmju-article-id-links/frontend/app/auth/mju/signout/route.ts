import { type NextRequest } from "next/server";
import { BACKEND_URL, clearSessionCookies } from "../../../lib/backend";
import { redirectToPath } from "../../../lib/redirect";
import { ACCESS_TOKEN_COOKIE } from "../../../lib/session";
import { AUTH_PROVIDER_COOKIE } from "../../../lib/mju-sso";

/**
 * GET /auth/mju/signout — where sso.mju.ac.th sends the browser after the
 * central sign-out. The local session is normally gone already (the logout
 * route clears it before redirecting to MJU); this is the safety net for a
 * sign-out started elsewhere at MJU.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (token) {
    await fetch(`${BACKEND_URL}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }

  const response = redirectToPath("/", {}, 303);
  response.headers.set("Cache-Control", "no-store");
  clearSessionCookies(response);
  response.cookies.delete(AUTH_PROVIDER_COOKIE);
  return response;
}
