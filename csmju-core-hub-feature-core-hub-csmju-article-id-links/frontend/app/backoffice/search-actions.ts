"use server";

import { apiFetch, getCurrentUser, type ReferenceDataset } from "../lib/api";
import { personDisplayName } from "../lib/people";
import { roleLabel, type UserRole } from "../lib/session";
import type { SearchGroup, SearchHit } from "../components/SearchBox";
import { navGroupsFor } from "./nav";
import { DATASET_LABELS } from "./reference/datasets";

/** Each group shows at most this many hits (reference data a few more). */
const PER_GROUP = 5;

/** GET /search — each key present only when the caller may read that group. */
type SearchResult = {
  people?: {
    personCode: string;
    personType: "STUDENT" | "STAFF";
    academicTitle: string | null;
    fullNameTh: string;
  }[];
  subsystems?: { id: string; name: string; displayName: string }[];
  announcements?: { id: string; title: string; category: string; isPublished: boolean }[];
  reference?: { dataset: ReferenceDataset; code: string; nameTh: string | null; isActive: boolean }[];
  users?: { email: string; username: string | null; role: UserRole }[];
};

function asGroup(label: string, hits: SearchHit[] | undefined): SearchGroup | null {
  return hits && hits.length > 0 ? { label, hits } : null;
}

/**
 * The backoffice header search: its menu pages (from the role's own menu)
 * and everything else in one Core API call, GET /search, which searches
 * each group under the permission its own list needs — one request per
 * query instead of a dozen, so typing cannot trip the per-user rate limit.
 */
export async function searchBackoffice(rawQuery: string): Promise<SearchGroup[]> {
  const q = rawQuery.trim().slice(0, 100);
  if (q.length < 2) return [];

  const user = await getCurrentUser();
  if (!user) return [];
  const lower = q.toLocaleLowerCase("th");

  const menu = navGroupsFor(user.role)
    .flatMap((g) => g.items.map((item) => ({ item, groupLabel: g.labelTh })))
    .filter(({ item }) =>
      [item.labelTh, item.label].some((t) => t.toLocaleLowerCase("th").includes(lower)),
    )
    .slice(0, PER_GROUP)
    .map(({ item, groupLabel }) => ({
      href: item.href,
      title: item.labelTh,
      detail: groupLabel ? `เมนู · ${groupLabel}` : "เมนู",
    }));

  let result: SearchResult = {};
  try {
    result = await apiFetch<SearchResult>(`/search?q=${encodeURIComponent(q)}`);
  } catch {
    // The menu still answers when the API does not.
  }

  return [
    asGroup("เมนู", menu),
    asGroup(
      "บุคคล",
      result.people?.map((p) => ({
        href:
          p.personType === "STUDENT"
            ? `/backoffice/students?q=${encodeURIComponent(p.personCode)}`
            : `/backoffice/faculty?q=${encodeURIComponent(p.personCode)}`,
        title: personDisplayName(p),
        detail: `${p.personType === "STUDENT" ? "นักศึกษา" : "บุคลากร"} · ${p.personCode}`,
      })),
    ),
    asGroup(
      "ระบบย่อย",
      result.subsystems?.map((s) => ({
        href: `/backoffice/subsystems/${encodeURIComponent(s.id)}`,
        title: s.displayName,
        detail: s.name,
      })),
    ),
    asGroup(
      "ประกาศ",
      result.announcements?.map((a) => ({
        href: `/backoffice/news?edit=${encodeURIComponent(a.id)}`,
        title: a.title,
        detail: `${a.category} · ${a.isPublished ? "เผยแพร่แล้ว" : "ฉบับร่าง"}`,
      })),
    ),
    asGroup(
      "ข้อมูลอ้างอิง",
      result.reference?.slice(0, PER_GROUP + 3).map((row) => ({
        href: `/backoffice/reference?${new URLSearchParams({ tab: row.dataset, q: row.code, active: "all" })}`,
        title: row.nameTh ? `${row.code} · ${row.nameTh}` : row.code,
        detail: `${DATASET_LABELS[row.dataset]}${row.isActive ? "" : " · ปิดใช้งาน"}`,
      })),
    ),
    asGroup(
      "บัญชีผู้ใช้",
      result.users?.map((u) => ({
        href: `/backoffice/users?q=${encodeURIComponent(u.email)}`,
        title: u.username ? `${u.username} · ${u.email}` : u.email,
        detail: `บัญชี · ${roleLabel(u.role)}`,
      })),
    ),
  ].filter((g): g is SearchGroup => g !== null);
}
