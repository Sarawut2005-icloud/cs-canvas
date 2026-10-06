import { CORE_HUB_BLOCKED_NEXT, safeNextPath } from "./next-path";

/**
 * /account/password/setup — sets a Core Hub password without the current one
 * (POST /auth/password/set): the first password of an MJU SSO account, or a
 * new one after "ลืมรหัสผ่าน". Edge-runtime safe (no next/headers).
 */
export const PASSWORD_SETUP_PATH = "/account/password/setup";

/** The page's own URL, carrying a `next` that already passed safeNextPath(). */
export function passwordSetupUrl(opts: { next?: string | null; reset?: boolean } = {}) {
  const query = new URLSearchParams();
  if (opts.reset) query.set("reset", "1");
  if (opts.next) query.set("next", opts.next);
  const search = query.toString();
  return search ? `${PASSWORD_SETUP_PATH}?${search}` : PASSWORD_SETUP_PATH;
}

/** Where to go once the password is set; never back into the setup page. */
export function afterPasswordSetup(rawNext: unknown): string | null {
  return safeNextPath(rawNext, [...CORE_HUB_BLOCKED_NEXT, PASSWORD_SETUP_PATH]);
}

/** Sends the browser to MJU SSO and back to the setup page in reset mode. */
export function mjuReauthUrl(next?: string | null) {
  return `/auth/mju/login?next=${encodeURIComponent(passwordSetupUrl({ reset: true, next }))}`;
}
