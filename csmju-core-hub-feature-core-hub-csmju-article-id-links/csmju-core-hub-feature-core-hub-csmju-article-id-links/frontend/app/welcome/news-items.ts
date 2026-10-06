import type { PublishedAnnouncement } from "../lib/api";
import { publishedAnnouncementImageUrl } from "../lib/announcements";
import type { CsmjuArticle } from "../lib/csmju-news";

/**
 * One card on the public news page — a csmju.com article or one of the
 * department's own published announcements, shown side by side by date.
 */
export type NewsItem = {
  key: string;
  title: string;
  content: string;
  category: string;
  imageUrl: string | null;
  /** csmju.com images go through next/image; ours come from our own proxy. */
  imageFromCsmju: boolean;
  date: string;
  href: string;
  /** Opens csmju.com in a new tab; announcements stay on this site. */
  external: boolean;
};

export function fromCsmjuArticle(article: CsmjuArticle): NewsItem {
  return {
    key: `csmju:${article.id}`,
    title: article.title,
    content: article.content,
    category: article.category,
    imageUrl: article.thumbnailUrl,
    imageFromCsmju: true,
    date: article.createdAt,
    href: article.href,
    external: true,
  };
}

export function fromAnnouncement(announcement: PublishedAnnouncement): NewsItem {
  return {
    key: `announcement:${announcement.id}`,
    title: announcement.title,
    content: announcement.content,
    category: announcement.category,
    imageUrl: publishedAnnouncementImageUrl(announcement),
    imageFromCsmju: false,
    date: announcement.publishedAt,
    href: `/announcements/${encodeURIComponent(announcement.id)}`,
    external: false,
  };
}

/** Newest first, whichever source it came from. */
export function byNewest(a: NewsItem, b: NewsItem): number {
  return Date.parse(b.date) - Date.parse(a.date);
}
