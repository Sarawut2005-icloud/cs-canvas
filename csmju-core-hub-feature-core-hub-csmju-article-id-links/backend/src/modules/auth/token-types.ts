/**
 * The three Core Hub token kinds (CORE_HUB_TOKEN_SCOPE 2.1). All share
 * `iss`, `kid` and RS256; they differ only by claim:
 *
 *   web access   aud=csmju2030           no azp      15 minutes
 *   handoff      aud=csmju2030           azp=<name>  15 minutes
 *   refresh      aud=core-hub-refresh    no azp      7 days
 *
 * A subsystem that checks `aud` refuses a refresh token on its own, and
 * `JwtStrategy` refuses it here.
 */
export const TOKEN_ISSUER = 'core-hub';
export const ACCESS_AUDIENCE = 'csmju2030';
export const REFRESH_AUDIENCE = 'core-hub-refresh';
export const SIGNING_KEY_ID = 'core-hub-2026';

/** `15m`, `7d`, `900s`, `500ms` → milliseconds. */
export function parseDurationToMs(duration: string): number {
  const match = duration.trim().match(/^(\d+)\s*(ms|s|m|h|d)$/i);

  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}
