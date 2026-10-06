import { listHiddenExternalContent, listPublishedAnnouncements } from "./api";
import { getLatestArticles } from "./csmju-news";
import {
  byNewest,
  fromAnnouncement,
  fromCsmjuArticle,
  type NewsItem,
} from "../welcome/news-items";

/**
 * The department's own announcements and csmju.com news, mixed by date and
 * newest first, without the csmju.com items admins hid. `failed` is true
 * when csmju.com could not be reached.
 */
export async function getNewsFeed(
  limit: number,
): Promise<{ items: NewsItem[]; failed: boolean }> {
  const hidden = await listHiddenExternalContent();
  const hiddenArticles = new Set(
    hidden.filter((h) => h.kind === "article").map((h) => h.externalId),
  );

  // Ask for extra articles so hiding some still leaves a full page.
  const [articles, announcements] = await Promise.all([
    getLatestArticles(limit + hiddenArticles.size),
    listPublishedAnnouncements(limit),
  ]);

  const items = [
    ...announcements.map(fromAnnouncement),
    ...(articles ?? [])
      .filter((article) => !hiddenArticles.has(article.id))
      .map(fromCsmjuArticle),
  ]
    .sort(byNewest)
    .slice(0, limit);

  return { items, failed: articles === null };
}
