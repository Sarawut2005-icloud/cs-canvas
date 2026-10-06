import { NextResponse } from "next/server";
import {
  BACKEND_URL,
  forwardedFor,
  setSessionCookies,
  type TokenPair,
} from "../../../lib/backend";
import { userFromToken } from "../../../lib/session";

/**
 * Turns a Core API rejection into something the sign-in form can show.
 * The backend answers 401 for bad credentials and 400 for a payload its
 * ValidationPipe refuses — swallowing the latter leaves the user retrying
 * a password that was never the problem.
 */
function loginErrorMessage(backendMessage?: string): string {
  if (!backendMessage) return "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

  if (backendMessage === "Invalid credentials") {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }

  // A person who left the registry (INACTIVE) — the reason stays generic.
  if (backendMessage === "This account can no longer sign in") {
    return "บัญชีนี้ไม่สามารถเข้าสู่ระบบได้แล้ว กรุณาติดต่อเจ้าหน้าที่สาขา";
  }

  if (backendMessage.includes("must be an email")) {
    return "รูปแบบอีเมลไม่ถูกต้อง เช่น admin@core.local";
  }

  if (backendMessage.includes("longer than or equal to 6")) {
    return "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร";
  }

  return backendMessage;
}

/**
 * Proxies login to the Core API and stores the returned tokens as httpOnly
 * cookies. Tokens never reach client-side JS; the login page only sees
 * success/failure.
 */
export async function POST(request: Request) {
  let email: unknown;
  let password: unknown;
  let remember = false;

  try {
    const body = await request.json();
    // Trim the email: a pasted address often carries a trailing space, which
    // the Core API's @IsEmail() rejects with a 400 the user can't interpret.
    email = typeof body.email === "string" ? body.email.trim() : body.email;
    password = body.password;
    remember = body.remember === true;
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "รูปแบบคำขอไม่ถูกต้อง" } },
      { status: 400 },
    );
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...forwardedFor(request.headers),
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { message: "ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้ กรุณาลองใหม่" },
      },
      { status: 503 },
    );
  }

  const body = await backendRes.json().catch(() => null);

  // Throttled or locked out after too many wrong passwords. Passed on as 429
  // with the wait, instead of the generic 400 below: the user has to be told
  // to wait, not to retype a password that may well be right.
  if (backendRes.status === 429) {
    const retryAfter = backendRes.headers.get("retry-after") ?? "";
    const seconds = Number(retryAfter);
    const wait =
      Number.isInteger(seconds) && seconds > 0
        ? seconds >= 60
          ? `${Math.ceil(seconds / 60)} นาที`
          : `${seconds} วินาที`
        : "สักครู่";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "TOO_MANY_REQUESTS",
          message: `พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ ${wait} แล้วลองใหม่`,
        },
      },
      {
        status: 429,
        headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
      },
    );
  }

  if (!backendRes.ok || !body?.success) {
    return NextResponse.json(
      {
        success: false,
        error: { message: loginErrorMessage(body?.error?.message) },
      },
      {
        status:
          backendRes.status === 401 || backendRes.status === 403
            ? backendRes.status
            : 400,
      },
    );
  }

  const tokens = body.data as TokenPair;
  const user = userFromToken(tokens.access_token);

  if (!user) {
    return NextResponse.json(
      { success: false, error: { message: "ได้รับโทเค็นที่ไม่ถูกต้องจากเซิร์ฟเวอร์" } },
      { status: 502 },
    );
  }

  const response = NextResponse.json({
    success: true,
    data: { email: user.email, role: user.role },
  });

  return setSessionCookies(response, tokens, remember);
}
