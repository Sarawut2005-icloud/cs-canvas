/**
 * Validates a `?next=` value before anything redirects to it.
 *
 * Returns a path inside this site, or null when the value must not be
 * followed. Edge-runtime safe: proxy.ts imports it, so this module must not
 * import `next/headers`.
 *
 * A value is accepted only when every rule holds (csmju2030 SSO spec 4.5):
 *
 *  1. a string of 1–512 characters;
 *  2. starts with `/` but not `//`, and contains no `\` — browsers read
 *     `/\host` the same as `//host`, which leaves the site;
 *  3. no control characters (0–31, 127);
 *  4. still resolves to this origin after `new URL(next, origin)`;
 *  5. is not one of `blockedPrefixes` or below one of them — the sign-in
 *     pages themselves, so a `next` cannot bounce the user back into the
 *     flow it is finishing.
 *
 * Callers check again at the moment they redirect, not only when the value
 * first arrives.
 */
export function safeNextPath(
  raw: unknown,
  blockedPrefixes: readonly string[],
): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) {
    return null;
  }

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return null;
  }

  // A loop rather than a regex range: eslint's no-control-regex rejects one.
  for (const char of raw) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return null;
  }

  const base = new URL("http://self.invalid");
  const url = new URL(raw, base);

  if (url.origin !== base.origin) return null;

  const blocked = blockedPrefixes.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
  );

  return blocked ? null : `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Pages a Core Hub `next` may never point at (spec 4.5 rule 5) — the sign-in
 * pages, and the MJU SSO round trip that ends in one.
 */
export const CORE_HUB_BLOCKED_NEXT = ["/login", "/logout", "/auth/mju"] as const;
