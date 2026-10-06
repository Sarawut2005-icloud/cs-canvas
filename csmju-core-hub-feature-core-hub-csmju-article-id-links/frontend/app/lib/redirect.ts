import { NextResponse } from "next/server";

/**
 * Redirects to a path on this site, sending `Location` as the path alone.
 *
 * `NextResponse.redirect(new URL(path, request.url))` is wrong in a route
 * handler: under `next start -H 0.0.0.0` (the Docker image) `request.url` is
 * built from the bind address, so the browser was sent to
 * http://0.0.0.0:3100/... — a host it cannot open, and not the one it holds
 * cookies for. A relative `Location` (RFC 9110 §10.2.2) resolves against the
 * address the browser actually used: localhost, or the tunnel's hostname.
 * proxy.ts does not need this; Next already shortens its same-origin
 * redirects to a path.
 *
 * `path` must start with a single `/`; `query` values are encoded here.
 */
export function redirectToPath(
  path: string,
  query: Record<string, string> = {},
  status: 302 | 303 | 307 = 302,
) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(`redirectToPath needs a path on this site, got ${path}`);
  }

  const search = new URLSearchParams(query).toString();

  return new NextResponse(null, {
    status,
    headers: { Location: search ? `${path}?${search}` : path },
  });
}
