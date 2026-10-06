import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "../../../../lib/session";
import { BACKEND_URL, clearSessionCookies, forwardedFor } from "../../../../lib/backend";

type Failure = { code?: string; message: string; details?: string[] };

function fail(status: number, error: Failure, headers?: HeadersInit) {
  return NextResponse.json({ success: false, error }, { status, headers });
}

/**
 * POST /api/auth/password/set — forwards to the Core API, which sets a
 * password without the current one only for an account that has none, or on
 * a session opened through MJU SSO in the last 10 minutes (403 otherwise).
 *
 * On success the Core API ends the user's other sessions and keeps this
 * one, so the cookies stay. The password passes through and is never logged.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return fail(401, { code: "UNAUTHORIZED", message: "กรุณาเข้าสู่ระบบ" });
  }

  let newPassword: unknown;
  try {
    newPassword = (await request.json()).newPassword;
  } catch {
    return fail(400, { code: "BAD_REQUEST", message: "รูปแบบคำขอไม่ถูกต้อง" });
  }

  if (typeof newPassword !== "string") {
    return fail(400, { code: "BAD_REQUEST", message: "รูปแบบคำขอไม่ถูกต้อง" });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/auth/password/set`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...forwardedFor(request.headers),
      },
      body: JSON.stringify({ newPassword }),
      cache: "no-store",
    });
  } catch {
    return fail(503, {
      code: "INTERNAL_ERROR",
      message: "ไม่สามารถเชื่อมต่อ Core API ได้ กรุณาลองใหม่",
    });
  }

  const body = await backendRes.json().catch(() => null);

  if (backendRes.ok && body?.success) {
    return NextResponse.json({ success: true });
  }

  if (backendRes.status === 401) {
    // The session is already gone (expired, or signed out elsewhere).
    return clearSessionCookies(
      fail(401, { code: "UNAUTHORIZED", message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" }),
    );
  }

  if (backendRes.status === 429) {
    const retryAfter = backendRes.headers.get("retry-after") ?? "";
    const seconds = Number(retryAfter);
    const wait =
      Number.isInteger(seconds) && seconds > 0
        ? seconds >= 60
          ? `${Math.ceil(seconds / 60)} นาที`
          : `${seconds} วินาที`
        : "สักครู่";
    return fail(
      429,
      {
        code: "TOO_MANY_REQUESTS",
        message: `ลองบ่อยเกินไป กรุณารอ ${wait} แล้วลองใหม่`,
      },
      retryAfter ? { "Retry-After": retryAfter } : undefined,
    );
  }

  return fail(backendRes.status >= 500 ? 502 : backendRes.status, {
    code: body?.error?.code,
    message: body?.error?.message ?? "ตั้งรหัสผ่านไม่สำเร็จ",
    details: Array.isArray(body?.error?.details) ? body.error.details : undefined,
  });
}
