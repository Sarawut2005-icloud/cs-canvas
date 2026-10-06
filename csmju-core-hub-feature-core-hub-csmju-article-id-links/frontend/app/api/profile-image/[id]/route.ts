import { NextResponse } from "next/server";
import { BACKEND_URL } from "../../../lib/backend";

/**
 * GET /api/profile-image/<id> — a profile picture's bytes.
 *
 * The browser cannot reach the Core API directly, so the file comes through
 * here. The Core API serves image files without a token; a new picture gets
 * a new id, so the response may be cached.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/images/${encodeURIComponent(id)}/file`, {
      cache: "no-store",
    });
  } catch {
    // api-conventions.md §4: a 503 carries Retry-After.
    return new NextResponse(null, { status: 503, headers: { "Retry-After": "5" } });
  }
  if (!res.ok) return new NextResponse(null, { status: res.status });

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
