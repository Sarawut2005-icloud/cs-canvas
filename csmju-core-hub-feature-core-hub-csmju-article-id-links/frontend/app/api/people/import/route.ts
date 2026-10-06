import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "../../../lib/session";
import { BACKEND_URL } from "../../../lib/backend";

/** JSON bodies up to this size are forwarded; the Core API caps at 2 MB too. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/people/import — forwards a CSV import to the Core API.
 *
 * A route handler rather than a server action: server actions cap their
 * body at 1 MB, and a full class list can be bigger. The access token stays
 * in the httpOnly cookie; the browser only ever talks to this route.
 * The CSV holds real names and emails — it is never logged here.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "กรุณาเข้าสู่ระบบ" } },
      { status: 401 },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "ไฟล์ใหญ่เกิน 2 MB" },
      },
      { status: 400 },
    );
  }

  let body: { mode?: unknown; csv?: unknown };
  try {
    body = JSON.parse(raw) as { mode?: unknown; csv?: unknown };
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "รูปแบบคำขอไม่ถูกต้อง" } },
      { status: 400 },
    );
  }

  if (
    (body.mode !== "dry-run" && body.mode !== "commit") ||
    typeof body.csv !== "string"
  ) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "รูปแบบคำขอไม่ถูกต้อง" } },
      { status: 400 },
    );
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/people/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mode: body.mode, csv: body.csv }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "ไม่สามารถเชื่อมต่อ Core API ได้" },
      },
      { status: 503 },
    );
  }

  const payload = await backendRes.json().catch(() => null);

  return NextResponse.json(
    payload ?? {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Core API ตอบกลับไม่ถูกต้อง" },
    },
    { status: backendRes.status },
  );
}
