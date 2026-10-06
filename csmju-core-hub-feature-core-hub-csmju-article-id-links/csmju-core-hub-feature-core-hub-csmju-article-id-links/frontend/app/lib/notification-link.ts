/**
 * A notification link the bell may render: a path on this site (not
 * `//host`, and no backslash, which browsers read as `/`) or an absolute
 * http(s) URL. Anything else — `javascript:`, `data:`, … — would run in the
 * portal when clicked, so it is dropped. The Core API filters the same way;
 * this is the second check.
 */
export function safeNotificationLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const value = link.trim();
  // A loop rather than a regex range: eslint's no-control-regex rejects one.
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || code === 0x5c) return null;
  }
  if (value.startsWith("/")) return value.startsWith("//") ? null : value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/** True for an absolute http(s) URL — those open in a new tab. */
export function isExternalLink(link: string): boolean {
  return /^https?:\/\//i.test(link);
}
