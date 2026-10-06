import { NextResponse, type NextRequest } from "next/server";
import { BACKEND_URL, clearSessionCookies } from "../../../lib/backend";
import { ACCESS_TOKEN_COOKIE } from "../../../lib/session";

/**
 * Where the portal and backoffice layouts send a visitor whose cookies look
 * signed in but whose session the Core API no longer accepts (signed out on
 * another device, revoked by an admin). Server components cannot clear
 * cookies, and redirecting to /login would loop — proxy.ts sends anyone with
 * a session cookie straight back.
 *
 * GET /api/auth/session-ended
 *
 * The cookies are cleared only when GET /auth/me really answers 401, so a
 * link to this route cannot sign out someone whose session is fine.
 */
/**
 * A relative `Location`, so the browser stays on the host it used — the dev
 * server reports `localhost` even when the page was opened on 127.0.0.1, and
 * the session cookies belong to the latter.
 */
function redirectHome() {
  return new NextResponse(null, { status: 307, headers: { Location: "/" } });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  let status: number | null = null;
  try {
    const res = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    status = res.status;
  } catch {
    // Unreachable — handled below with the other failures.
  }

  if (status === 401) return clearSessionCookies(redirectHome());
  if (status !== null && status < 400) return redirectHome();

  // Core API down or failing: bouncing to `/` would come straight back here.
  return new NextResponse("ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
