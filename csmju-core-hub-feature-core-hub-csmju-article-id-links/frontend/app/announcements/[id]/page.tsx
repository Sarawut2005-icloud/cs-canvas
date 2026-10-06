import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowBackIcon, CalendarTodayIcon } from "../../components/icons";
import { getPublishedAnnouncement } from "../../lib/api";
import { publishedAnnouncementImageUrl } from "../../lib/announcements";
import { formatDate } from "../../lib/format";
import { SiteFooter, SiteHeader } from "../../welcome/SiteChrome";

/** Plain text — paragraphs split on blank lines, never rendered as HTML. */
function paragraphsOf(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export async function generateMetadata({
  params,
}: PageProps<"/announcements/[id]">): Promise<Metadata> {
  const announcement = await getPublishedAnnouncement((await params).id);
  return {
    title: announcement
      ? `${announcement.title} · CSMJU Portal`
      : "ไม่พบประกาศ · CSMJU Portal",
  };
}

/**
 * Public page of a published announcement, linked from the news front page.
 * proxy.ts lets signed-out visitors in; drafts answer 404.
 */
export default async function AnnouncementPage({
  params,
}: PageProps<"/announcements/[id]">) {
  const announcement = await getPublishedAnnouncement((await params).id);
  if (!announcement) notFound();

  const imageUrl = publishedAnnouncementImageUrl(announcement);
  const paragraphs = paragraphsOf(announcement.content);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
        <Link
          href="/"
          className="fade-slide-up inline-flex items-center gap-2 self-start text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <ArrowBackIcon className="h-4 w-4" />
          ข่าวสารทั้งหมด
        </Link>

        <article className="fade-slide-up stagger-1 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- served by our own image proxy, not next/image
            <img
              src={imageUrl}
              alt={announcement.title}
              className="max-h-[28rem] w-full bg-surface-container object-cover"
            />
          )}

          <div className="p-6 md:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3 text-caption text-on-surface-variant">
              <span className="rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary">
                {announcement.category}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarTodayIcon className="h-3.5 w-3.5" />
                {formatDate(announcement.publishedAt)}
              </span>
            </div>

            <h1 className="mb-6 font-display text-[24px] font-bold leading-[1.3] text-on-surface md:text-headline-lg">
              {announcement.title}
            </h1>

            <div className="space-y-4 text-body-md leading-relaxed text-on-surface">
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
