import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "../../../lib/session";
import {
  BACKEND_URL,
  clearSessionCookies,
  forwardedFor,
} from "../../../lib/backend";
import {
  AUTH_PROVIDER_COOKIE,
  mjuSignOutUrl,
  mjuSsoEnabled,
} from "../../../lib/mju-sso";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const viaMju = cookieStore.get(AUTH_PROVIDER_COOKIE)?.value === "mju";

  if (token) {
    // Best-effort: revoke the session server-side, but clear cookies
    // regardless of whether the backend call succeeds.
    await fetch(`${BACKEND_URL}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...forwardedFor(request.headers),
      },
      cache: "no-store",
    }).catch(() => undefined);
  }

  // A session opened through MJU SSO is closed at MJU too: the local
  // cookies are cleared here first, then the browser is sent to signout.aspx,
  // which returns to /auth/mju/signout. The URL comes from configuration only.
  const redirect = viaMju && mjuSsoEnabled() ? mjuSignOutUrl() : undefined;

  const response = NextResponse.json({
    success: true,
    data: { loggedOut: true, ...(redirect && { redirect }) },
  });
  response.cookies.delete(AUTH_PROVIDER_COOKIE);
  return clearSessionCookies(response);
}
