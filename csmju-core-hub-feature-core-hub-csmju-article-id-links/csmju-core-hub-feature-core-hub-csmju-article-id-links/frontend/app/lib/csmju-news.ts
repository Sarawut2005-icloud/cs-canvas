/**
 * Public news from the department website (csmju.com). Its articles API is
 * open, so the landing page reads it server-side and caches the result — the
 * visitor's browser never talks to csmju.com except to load thumbnails.
 */
export const CSMJU_SITE_URL =
  process.env.CSMJU_SITE_URL ?? "https://csmju.com";

/** How long a fetched response is reused before csmju.com is asked again — edits there show up here within this window. */
const REVALIDATE_SECONDS = 60;

export type CsmjuArticle = {
  id: string;
  slug: string;
  title: string;
  content: string;
  /** External link set by the editor; empty when the article stands alone. */
  link: string;
  category: string;
  thumbnailUrl: string | null;
  createdAt: string;
  /** Where "อ่านต่อ" should take the visitor. */
  href: string;
};

type RawArticle = {
  id: string;
  slug: string;
  title: string;
  content?: string | null;
  link?: string | null;
  category?: string | null;
  published?: boolean;
  thumbnail?: { url?: string | null } | null;
  createdAt: string;
};

/**
 * Latest published articles, newest first. Returns `null` when csmju.com is
 * unreachable or answers with something unexpected, so the page can show a
 * fallback instead of failing to render.
 */
export async function getLatestArticles(
  limit = 7,
): Promise<CsmjuArticle[] | null> {
  const url = new URL("/api/articles", CSMJU_SITE_URL);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sortBy", "createdAt:DESC");

  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { data?: RawArticle[] };
    if (!Array.isArray(body.data)) return null;

    return body.data
      .filter((article) => article.published !== false)
      .map((article) => ({
        id: article.id,
        slug: article.slug,
        title: article.title,
        content: article.content ?? "",
        link: article.link ?? "",
        category: article.category ?? "",
        thumbnailUrl: article.thumbnail?.url ?? null,
        createdAt: article.createdAt,
        // By id: csmju.com renders an error page for its Thai slugs
        // (/articles/<slug> answers 200 with no article), while
        // /articles/<id> opens the article.
        href: new URL(
          `/articles/${encodeURIComponent(article.id)}`,
          CSMJU_SITE_URL,
        ).toString(),
      }));
  } catch {
    return null;
  }
}

export type CsmjuBanner = {
  id: string;
  title: string;
  imageUrl: string;
  /** Absolute URL the banner opens, or `null` when the editor left it blank. */
  href: string | null;
};

type RawBanner = {
  id: string;
  title: string;
  link?: string | null;
  image?: { url?: string | null } | null;
  isActive?: boolean;
  sortOrder?: number;
  createdAt: string;
};

/**
 * Active banners from the csmju.com home-page slider (e.g. TCAS admission
 * posters), ordered the way the editor arranged them. Banners without an image
 * are skipped. Returns an empty list when csmju.com is unreachable — the
 * slider is decoration, so the page simply renders without it.
 */
export async function getActiveBanners(): Promise<CsmjuBanner[]> {
  const url = new URL("/api/carousels", CSMJU_SITE_URL);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", "20");

  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const body = (await res.json()) as { data?: RawBanner[] };
    if (!Array.isArray(body.data)) return [];

    return body.data
      .filter((banner) => banner.isActive !== false && banner.image?.url)
      .sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .map((banner) => ({
        id: banner.id,
        title: banner.title,
        imageUrl: banner.image!.url!,
        href: banner.link
          ? new URL(banner.link, CSMJU_SITE_URL).toString()
          : null,
      }));
  } catch {
    return [];
  }
}
