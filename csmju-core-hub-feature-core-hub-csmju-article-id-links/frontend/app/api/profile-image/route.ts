import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "../../lib/session";
import { BACKEND_URL, forwardedFor } from "../../lib/backend";
import { MAX_PROFILE_IMAGE_BYTES, PROFILE_IMAGE_TYPES } from "../../lib/profile-image";

/** Seconds a client should wait before retrying while the Core API is down. */
const RETRY_AFTER_SECONDS = "5";

function fail(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    {
      status,
      // api-conventions.md §4: a 503 carries Retry-After.
      ...(status === 503 ? { headers: { "Retry-After": RETRY_AFTER_SECONDS } } : {}),
    },
  );
}

/**
 * POST /api/profile-image — uploads the signed-in user's profile picture.
 *
 * The browser already shrank the file to 1 MB; the limit and the JPG/PNG
 * rule are checked again here because nothing stops a caller skipping that
 * step. The Core API makes it the account's current picture.
 */
export async function POST(request: Request) {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return fail(401, "UNAUTHORIZED", "กรุณาเข้าสู่ระบบ");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "BAD_REQUEST", "รูปแบบคำขอไม่ถูกต้อง");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "BAD_REQUEST", "ไม่พบไฟล์รูปภาพ");
  if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
    return fail(400, "VALIDATION_ERROR", "รองรับเฉพาะไฟล์ JPG หรือ PNG");
  }
  if (file.size > MAX_PROFILE_IMAGE_BYTES) {
    return fail(400, "VALIDATION_ERROR", "รูปภาพต้องมีขนาดไม่เกิน 1 MB");
  }

  const upload = new FormData();
  upload.set("category", "PROFILE");
  upload.set("file", file, file.name || "profile");

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/images`, {
      method: "POST",
      headers: {
        ...forwardedFor(await headers()),
        Authorization: `Bearer ${token}`,
      },
      body: upload,
      cache: "no-store",
    });
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE", "ไม่สามารถเชื่อมต่อ Core API ได้");
  }

  const payload = await res.json().catch(() => null);
  return NextResponse.json(
    payload ?? {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Core API ตอบกลับไม่ถูกต้อง" },
    },
    { status: res.status },
  );
}
