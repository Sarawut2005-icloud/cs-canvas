import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REMEMBER_COOKIE,
  homePathFor,
  isTokenExpired,
  safeDecodeJwtPayload,
  type UserRole,
} from "./app/lib/session";
import {
  clearSessionCookies,
  refreshTokens,
  setSessionCookies,
  type TokenPair,
} from "./app/lib/backend";
import { CORE_HUB_BLOCKED_NEXT, safeNextPath } from "./app/lib/next-path";

const LOGIN_PATH = "/login";
const LOGOUT_PATH = "/logout";
/** Public news page anonymous visitors see at `/`. */
const WELCOME_PATH = "/welcome";
/**
 * Open to everyone: published announcements linked from the news page, and
 * the MJU SSO entry/return routes (a visitor arriving from sso.mju.ac.th has
 * no session yet — that is the point), and the public curricula pages.
 */
const PUBLIC_PREFIXES = ["/announcements/", "/auth/mju/", "/curricula/"];

/** Public pages matched exactly — a bare prefix would open any path that starts the same way. */
const PUBLIC_PATHS = [WELCOME_PATH, "/curricula"];

/**
 * Session gate in front of every page request:
 *
 *  1. silently rotates an expired access token against POST /auth/refresh,
 *     so a user with a live session is never bounced to /login;
 *  2. shows anonymous visitors the public news page at `/` (plus `/welcome`
 *     and the announcement pages it links to); every other page sends them
 *     to /login, keeping the whole path *and query* as `?next=` —
 *     /sso/authorize carries `subsystem` and the subsystem's `state` in its
 *     query, and dropping them strands the user on the portal instead of
 *     sending them on to the subsystem;
 *  3. sends a signed-in visitor of /login on to a safe `next`, which is how
 *     a user whose access cookie had expired still reaches the subsystem,
 *     and a signed-in visitor of /welcome to their home page;
 *  4. lets anyone signed in reach /backoffice URLs: the backoffice layout
 *     shows other roles a "no permission" page (ui-design-system §9.3)
 *     instead of quietly sending them elsewhere.
 *
 * This only reads the JWT claims to decide navigation — signatures are
 * verified by the Core API on every request, and the layouts re-check the
 * session against GET /auth/me before rendering.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  let rotated: TokenPair | null = null;
  let sessionLost = false;

  if (!accessToken || isTokenExpired(accessToken)) {
    const hadCookies = !!accessToken || !!refreshToken;

    if (refreshToken && !isTokenExpired(refreshToken)) {
      rotated = await refreshTokens(refreshToken, request.headers);
    }

    if (rotated) {
      accessToken = rotated.access_token;
      // Rewrite the incoming Cookie header so the server components
      // rendering *this* request already see the fresh token.
      request.cookies.set(ACCESS_TOKEN_COOKIE, rotated.access_token);
      request.cookies.set(REFRESH_TOKEN_COOKIE, rotated.refresh_token);
    } else {
      accessToken = undefined;
      sessionLost = hadCookies;
      request.cookies.delete(ACCESS_TOKEN_COOKIE);
      request.cookies.delete(REFRESH_TOKEN_COOKIE);
    }
  }

  const role = accessToken
    ? (safeDecodeJwtPayload(accessToken)?.role as UserRole | undefined)
    : undefined;
  const signedIn = !!accessToken;

  /** Mirrors the rotated (or cleared) cookies onto whatever response we send. */
  const withSession = (response: NextResponse) => {
    if (rotated) {
      return setSessionCookies(
        response,
        rotated,
        request.cookies.has(REMEMBER_COOKIE),
      );
    }
    if (sessionLost) return clearSessionCookies(response);
    return response;
  };

  const redirectTo = (target: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = search;
    return withSession(NextResponse.redirect(url));
  };

  if (!signedIn && pathname === "/") {
    // Rewrite rather than redirect so the address bar keeps showing `/`.
    const url = request.nextUrl.clone();
    url.pathname = WELCOME_PATH;
    return withSession(NextResponse.rewrite(url));
  }

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!signedIn && !isPublic && pathname !== LOGIN_PATH) {
    // Nothing to confirm when there is no session to end.
    if (pathname === LOGOUT_PATH) return redirectTo(LOGIN_PATH);

    const here = `${pathname}${request.nextUrl.search}`;
    const login = new URLSearchParams();
    if (here !== "/") login.set("next", here);
    const search = login.toString();

    return redirectTo(LOGIN_PATH, search ? `?${search}` : "");
  }

  if (signedIn && pathname === LOGIN_PATH) {
    const next = safeNextPath(
      request.nextUrl.searchParams.get("next"),
      CORE_HUB_BLOCKED_NEXT,
    );

    // `next` may carry its own query (/sso/authorize?subsystem=…), so it is
    // resolved as a URL instead of being split into pathname and search.
    if (next) {
      return withSession(NextResponse.redirect(new URL(next, request.url)));
    }

    return redirectTo(homePathFor(role));
  }

  if (signedIn && pathname === WELCOME_PATH) {
    return redirectTo(homePathFor(role));
  }

  return withSession(
    NextResponse.next({ request: { headers: request.headers } }),
  );
}

export const config = {
  // /api/auth/* route handlers manage the session cookies themselves.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\.png$).*)"],
};
