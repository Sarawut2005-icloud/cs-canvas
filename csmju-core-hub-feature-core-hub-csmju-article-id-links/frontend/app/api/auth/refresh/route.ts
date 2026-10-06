import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  clearSessionCookies,
  refreshTokens,
  setSessionCookies,
} from "../../../lib/backend";
import {
  REFRESH_TOKEN_COOKIE,
  REMEMBER_COOKIE,
  userFromToken,
} from "../../../lib/session";

/**
 * Rotates the session against POST /auth/refresh. The proxy refreshes
 * expired access tokens on navigation; this route exists for client-side
 * code that needs to renew the session explicitly.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { success: false, error: { message: "ไม่พบ refresh token" } },
      { status: 401 },
    );
  }

  const tokens = await refreshTokens(refreshToken, request.headers);

  if (!tokens) {
    const failed = NextResponse.json(
      { success: false, error: { message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" } },
      { status: 401 },
    );
    return clearSessionCookies(failed);
  }

  const user = userFromToken(tokens.access_token);

  const response = NextResponse.json({
    success: true,
    data: { email: user?.email, role: user?.role },
  });

  return setSessionCookies(
    response,
    tokens,
    cookieStore.has(REMEMBER_COOKIE),
  );
}
