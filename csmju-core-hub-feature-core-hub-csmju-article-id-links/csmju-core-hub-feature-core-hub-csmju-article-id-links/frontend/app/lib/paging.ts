/** Page sizes the tables offer; the API caps `limit` at 100. */
export const PAGE_SIZES = [10, 25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 25;

/** `?limit=` → one of PAGE_SIZES (anything else falls back to the default). */
export function parseLimit(
  raw: string | string[] | undefined,
  fallback: number = DEFAULT_PAGE_SIZE,
): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return (PAGE_SIZES as readonly number[]).includes(value) ? value : fallback;
}

/** `?page=` → positive integer, default 1. */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(value) && value > 0 ? value : 1;
}
