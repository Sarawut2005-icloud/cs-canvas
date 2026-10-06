import { type NextRequest } from "next/server";
import { redirectToPath } from "../../../lib/redirect";

/**
 * Former SSO launcher: GET /api/sso/<subsystem>.
 *
 * Superseded by /sso/authorize, which sits outside /api so proxy.ts can renew
 * an expired session before the handoff. Kept as a redirect because users may
 * have bookmarked the old link. Any query is dropped: this route used to mint
 * its own `state`, and a state may only ever come from the subsystem.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ subsystem: string }> },
) {
  const { subsystem } = await params;
  return redirectToPath("/sso/authorize", { subsystem }, 307);
}
