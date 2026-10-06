import type { Metadata } from "next";
import Link from "next/link";
import {
  getCurrentUser,
  listAnnouncements,
  listHiddenExternalContent,
  type Announcement,
} from "../../lib/api";
import { getActiveBanners, getLatestArticles } from "../../lib/csmju-news";
import PageHeader from "../_components/PageHeader";
import { cardClass } from "../_components/ui";
import { ErrorState } from "../subsystems/_components/StateViews";
import AnnouncementsTable from "./AnnouncementsTable";
import ListSearch from "../_components/ListSearch";
import ExternalContentTable, {
  type ExternalContentRow,
} from "./ExternalContentTable";

export const metadata: Metadata = {
  title: "ประกาศ · BackOffice · CSMJU",
};

/** How many recent csmju.com articles the admin can pick from. */
const CSMJU_ARTICLE_LIMIT = 30;

const TABS = [
  { id: "announcements", label: "ประกาศของสาขา" },
  { id: "csmju", label: "ข่าวจาก csmju.com" },
] as const;

export default async function NewsPage({
  searchParams,
}: PageProps<"/backoffice/news">) {
  const user = await getCurrentUser();
  // Only admins may hide csmju.com items, so only they see that tab.
  const isAdmin = user?.role === "admin";
  const { tab, edit, q } = await searchParams;
  const activeTab = isAdmin && tab === "csmju" ? "csmju" : "announcements";

  return (
    <>
      <PageHeader
        title="ประกาศ"
        description={
          activeTab === "csmju"
            ? "เลือกซ่อนข่าวหรือแบนเนอร์จาก csmju.com ไม่ให้แสดงบนหน้าแรก ข่าวบน csmju.com ยังอยู่เหมือนเดิม"
            : "สร้าง แก้ไข และเผยแพร่ประกาศของสาขา"
        }
      />

      {isAdmin && (
        <nav
          aria-label="ประเภทประกาศ"
          className="fade-slide-up flex gap-1 border-b border-outline-variant/40"
        >
          {TABS.map(({ id, label }) => (
            <Link
              key={id}
              href={id === "announcements" ? "/backoffice/news" : "/backoffice/news?tab=csmju"}
              aria-current={activeTab === id ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2.5 text-label-md transition-colors ${
                activeTab === id
                  ? "border-primary-container text-primary-container"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}

      {activeTab === "csmju" ? (
        <CsmjuContent />
      ) : (
        <Announcements
          canDelete={isAdmin}
          q={typeof q === "string" ? q.trim() : ""}
          editId={typeof edit === "string" ? edit : undefined}
        />
      )}
    </>
  );
}

async function Announcements({
  canDelete,
  q,
  editId,
}: {
  canDelete: boolean;
  /** `?q=` — title or content contains it. */
  q: string;
  /** `?edit=<id>` from the header search opens that announcement. */
  editId?: string;
}) {
  let announcements: Announcement[];
  try {
    ({ data: announcements } = await listAnnouncements({ limit: 100, q: q || undefined }));
  } catch (error) {
    return <ErrorState error={error} />;
  }

  return (
    <div className="space-y-4">
      <ListSearch q={q} placeholder="ค้นหาหัวข้อหรือเนื้อหาประกาศ" clearHref="/backoffice/news" />
      <div className={`fade-slide-up stagger-1 ${cardClass}`}>
        {/* Keyed by ?edit= so a search hit on this same page opens its editor. */}
        <AnnouncementsTable
          key={editId ?? "list"}
          announcements={announcements}
          canDelete={canDelete}
          initialEditId={editId}
          showCreate
          emptyMessage={
            q
              ? `ไม่พบประกาศที่ตรงกับ “${q}”`
              : "ยังไม่มีประกาศ กด “สร้างประกาศใหม่” เพื่อเริ่มต้น"
          }
        />
      </div>
    </div>
  );
}

async function CsmjuContent() {
  const [articles, banners, hidden] = await Promise.all([
    getLatestArticles(CSMJU_ARTICLE_LIMIT),
    getActiveBanners(),
    listHiddenExternalContent(),
  ]);

  const hiddenKeys = new Set(hidden.map((h) => `${h.kind}:${h.externalId}`));
  const isHidden = (kind: string, id: string) => hiddenKeys.has(`${kind}:${id}`);

  const rows: ExternalContentRow[] = [
    ...banners.map((banner) => ({
      kind: "banner" as const,
      externalId: banner.id,
      title: banner.title,
      imageUrl: banner.imageUrl,
      date: null,
      href: banner.href,
      hidden: isHidden("banner", banner.id),
      gone: false,
    })),
    ...(articles ?? []).map((article) => ({
      kind: "article" as const,
      externalId: article.id,
      title: article.title,
      imageUrl: article.thumbnailUrl,
      date: article.createdAt,
      href: article.href,
      hidden: isHidden("article", article.id),
      gone: false,
    })),
  ];

  // Hidden items csmju.com no longer lists (or that fell off the recent list)
  // stay here so an admin can still show them again.
  const listed = new Set(rows.map((row) => `${row.kind}:${row.externalId}`));
  for (const item of hidden) {
    if (listed.has(`${item.kind}:${item.externalId}`)) continue;
    rows.push({
      kind: item.kind,
      externalId: item.externalId,
      title: item.title,
      imageUrl: null,
      date: null,
      href: null,
      hidden: true,
      gone: true,
    });
  }

  return (
    <div className={`fade-slide-up stagger-1 ${cardClass}`}>
      <ExternalContentTable rows={rows} />
    </div>
  );
}
