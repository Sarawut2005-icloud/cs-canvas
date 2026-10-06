"use server";

import type { SearchGroup, SearchHit } from "../components/SearchBox";
import { BACKOFFICE_ROLES } from "./session";
import { getCurrentUser, getLinkedSubsystems } from "./api";
import { getNewsFeed } from "./news-feed";
import { listPublicCurricula } from "./public-curricula";
import { NAV_ITEMS } from "../(portal)/nav";

/** Each group shows at most this many hits. */
const PER_GROUP = 5;
/** How much of the news feed a search looks through. */
const NEWS_SCOPE = 50;

function matcher(query: string) {
  const q = query.trim().toLocaleLowerCase("th");
  return (...texts: (string | null | undefined)[]) =>
    texts.some((t) => (t ?? "").toLocaleLowerCase("th").includes(q));
}

function asGroup(label: string, hits: SearchHit[]): SearchGroup | null {
  return hits.length > 0 ? { label, hits: hits.slice(0, PER_GROUP) } : null;
}

/** News (announcements + csmju.com) and active curricula — public data. */
async function publicGroups(query: string): Promise<(SearchGroup | null)[]> {
  const has = matcher(query);
  const [feed, curricula] = await Promise.all([
    getNewsFeed(NEWS_SCOPE).catch(() => ({ items: [], failed: true })),
    listPublicCurricula(),
  ]);

  const news = feed.items
    .filter((item) => has(item.title, item.content, item.category))
    .map((item) => ({
      href: item.href,
      title: item.title,
      detail: `ข่าวสาร${item.category ? ` · ${item.category}` : ""}${item.external ? " · csmju.com" : ""}`,
    }));

  const programs = (curricula.ok ? (curricula.data ?? []) : [])
    .filter((c) => has(c.code, c.nameTh, c.nameEn))
    .map((c) => ({
      href: `/curricula/${encodeURIComponent(c.code)}`,
      title: c.nameTh,
      detail: `หลักสูตร พ.ศ. ${c.curriculumYear}`,
    }));

  return [asGroup("ข่าวสาร", news), asGroup("หลักสูตร", programs)];
}

/**
 * Search box of the public website: news and curricula only. Everything it
 * finds is already public, so no sign-in is involved.
 */
export async function searchPublic(rawQuery: string): Promise<SearchGroup[]> {
  const q = rawQuery.trim().slice(0, 100);
  if (q.length < 2) return [];
  return (await publicGroups(q)).filter((g): g is SearchGroup => g !== null);
}

/**
 * Search box of the portal: its menu, the subsystems the user may enter
 * (GET /subsystems/directory — already filtered by role and exceptions),
 * news and curricula.
 */
export async function searchPortal(rawQuery: string): Promise<SearchGroup[]> {
  const q = rawQuery.trim().slice(0, 100);
  if (q.length < 2) return [];
  const has = matcher(q);

  const user = await getCurrentUser();
  if (!user) return searchPublic(q);

  const menuItems = [
    ...NAV_ITEMS.map(({ href, label }) => ({ href, label })),
    ...(BACKOFFICE_ROLES.includes(user.role) ? [{ href: "/backoffice", label: "ระบบหลังบ้าน" }] : []),
    { href: "/account/password", label: "เปลี่ยนรหัสผ่าน" },
  ];
  const menu = menuItems
    .filter((item) => has(item.label))
    .map((item) => ({ href: item.href, title: item.label, detail: "เมนู" }));

  const [subsystems, rest] = await Promise.all([
    getLinkedSubsystems().catch(() => []),
    publicGroups(q),
  ]);
  const apps = subsystems
    .filter((s) => has(s.displayName, s.name, s.description))
    .map((s) => ({
      href: `/sso/authorize?subsystem=${encodeURIComponent(s.name)}`,
      title: s.displayName,
      detail: `ระบบย่อย${s.description ? ` · ${s.description}` : ""}`,
    }));

  return [asGroup("เมนู", menu), asGroup("ระบบย่อย", apps), ...rest].filter(
    (g): g is SearchGroup => g !== null,
  );
}
