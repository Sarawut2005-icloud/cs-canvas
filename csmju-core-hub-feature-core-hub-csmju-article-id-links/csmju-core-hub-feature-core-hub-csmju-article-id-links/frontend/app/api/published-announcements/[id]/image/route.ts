import { NextResponse } from "next/server";
import { BACKEND_URL } from "../../../../lib/backend";

/**
 * Cover image of a published announcement for the public front page:
 * GET /api/published-announcements/<id>/image
 *
 * The browser cannot reach the Core API directly, so the image comes through
 * here. No token is needed — the Core API serves published images to anyone
 * and answers 404 for drafts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let res: Response;
  try {
    res = await fetch(
      `${BACKEND_URL}/published-announcements/${encodeURIComponent(id)}/image`,
      { cache: "no-store" },
    );
  } catch {
    return new NextResponse(null, { status: 503 });
  }
  if (!res.ok) return new NextResponse(null, { status: res.status });

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      // The URL carries `?v=<imageUpdatedAt>`, so a new image gets a new URL.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
