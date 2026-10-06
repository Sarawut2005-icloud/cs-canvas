export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Returned by list handlers so the envelope carries `meta` next to `data`
 * (api-conventions.md §3 — collections must always include `meta`).
 * ResponseInterceptor splits it into `{ data, meta }` on the way out.
 */
export class Paginated<T> {
  constructor(
    public readonly items: T[],
    public readonly meta: PageMeta,
  ) {}

  static of<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): Paginated<T> {
    return new Paginated(items, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  /** Same page, items converted (e.g. records to API views). */
  map<U>(convert: (item: T) => U): Paginated<U> {
    return new Paginated(this.items.map(convert), this.meta);
  }
}
