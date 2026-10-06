import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "../../../lib/session";
import { BACKEND_URL, forwardedFor } from "../../../lib/backend";

/** The list filters GET /people/export accepts — nothing else is forwarded. */
const FILTERS = ["personType", "status", "entryYear", "departmentCode", "q"];

/**
 * GET /api/people/export?<filters> — the people list as CSV from the Core API.
 *
 * The browser cannot send the access token itself (httpOnly cookie), so the
 * file comes through here. The Core API checks `people:export` and writes
 * the audit log; this route never reads or logs the rows.
 */
export async function GET(request: Request) {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "กรุณาเข้าสู่ระบบ" } },
      { status: 401 },
    );
  }

  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of FILTERS) {
    const value = incoming.get(key)?.trim();
    if (value) query.set(key, value);
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/people/export?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, ...forwardedFor(await headers()) },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "ไม่สามารถเชื่อมต่อ Core API ได้" },
      },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }

  // Errors stay JSON envelopes; only a successful export is a file.
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    return NextResponse.json(
      payload ?? {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Core API ตอบกลับไม่ถูกต้อง" },
      },
      { status: res.status },
    );
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? 'attachment; filename="people.csv"',
      "Cache-Control": "no-store",
    },
  });
}
