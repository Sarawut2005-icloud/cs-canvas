import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "../../../../lib/session";
import { BACKEND_URL } from "../../../../lib/backend";

/**
 * Announcement cover image: GET / PUT / DELETE /api/announcements/<id>/image
 *
 * The browser cannot attach the Core API's Bearer token (it lives in an
 * httpOnly cookie), so `<img>` tags and the upload form go through here and
 * this route forwards the call with the caller's own token. The Core API
 * still decides whether they may.
 */

type Context = { params: Promise<{ id: string }> };

async function backend(id: string, init: RequestInit): Promise<Response> {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in" } },
      { status: 401 },
    );
  }

  try {
    return await fetch(
      `${BACKEND_URL}/announcements/${encodeURIComponent(id)}/image`,
      {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Core API unreachable" },
      },
      { status: 503 },
    );
  }
}

/** Passes the Core API's JSON answer (envelope or error) straight through. */
async function relayJson(res: Response) {
  const body = await res.json().catch(() => null);
  return NextResponse.json(body, { status: res.status });
}

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const res = await backend(id, { method: "GET" });

  if (!res.ok) return new NextResponse(null, { status: res.status });

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      // The URL carries `?v=<imageUpdatedAt>`, so a new image gets a new URL.
      "Cache-Control": "private, max-age=86400",
    },
  });
}

export async function PUT(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const form = await request.formData().catch(() => null);
  const file = form?.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "An image file is required" },
      },
      { status: 400 },
    );
  }

  const upstream = new FormData();
  upstream.append("image", file, file.name);
  return relayJson(await backend(id, { method: "PUT", body: upstream }));
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  return relayJson(await backend(id, { method: "DELETE" }));
}
