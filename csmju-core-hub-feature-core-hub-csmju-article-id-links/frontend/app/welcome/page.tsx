import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowForwardIcon,
  CalendarTodayIcon,
  CampaignIcon,
  OpenInNewIcon,
} from "../components/icons";
import { CSMJU_SITE_URL, getActiveBanners } from "../lib/csmju-news";
import { listHiddenExternalContent } from "../lib/api";
import { getNewsFeed } from "../lib/news-feed";
import { formatDate } from "../lib/format";
import BannerCarousel from "./BannerCarousel";
import type { NewsItem } from "./news-items";
import { SiteFooter, SiteHeader } from "./SiteChrome";

export const metadata: Metadata = {
  title: "CSMJU Portal - ข่าวสาร",
};

/** Featured item plus two rows of three cards. */
const ITEMS_SHOWN = 7;

/**
 * Public front page for anonymous visitors. proxy.ts rewrites `/` here when
 * nobody is signed in, so the address bar keeps showing `/`; signing in goes
 * through the existing /login page.
 */
export default async function WelcomePage() {
  // Admins hide csmju.com items from the backoffice; csmju.com still has them.
  const hidden = await listHiddenExternalContent();
  const hiddenBanners = new Set(
    hidden.filter((h) => h.kind === "banner").map((h) => h.externalId),
  );

  const [{ items, failed }, fetchedBanners] = await Promise.all([
    getNewsFeed(ITEMS_SHOWN),
    getActiveBanners(),
  ]);
  const banners = fetchedBanners.filter(
    (banner) => !hiddenBanners.has(banner.id),
  );
  const [featured, ...rest] = items;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />

      <section className="brand-gradient relative overflow-hidden text-white">
        <div className="glow-circle left-[-10%] top-[-40%] h-64 w-64 bg-[#3B80F2]" />
        <div className="glow-circle bottom-[-60%] right-[-5%] h-96 w-96 bg-[#F59E0B] opacity-20" />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10 md:px-8 md:py-14">
          <p className="fade-slide-up text-label-md uppercase tracking-wider text-primary-fixed">
            สาขาวิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยแม่โจ้
          </p>
          <h1 className="fade-slide-up stagger-1 mt-2 font-display text-[28px] font-bold leading-[1.3] md:text-headline-lg">
            ข่าวสารและประชาสัมพันธ์
          </h1>
          <p className="fade-slide-up stagger-2 mt-3 max-w-2xl text-body-md text-primary-fixed opacity-90 md:text-body-lg">
            ติดตามกิจกรรม โครงการ และประกาศล่าสุดจากสาขาวิชา
          </p>
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <BannerCarousel banners={banners} />

        {!featured ? (
          <NewsUnavailable failed={failed} />
        ) : (
          <div className="flex flex-col gap-8">
            <FeaturedItem item={featured} />

            {rest.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((item, index) => (
                  <NewsCard
                    key={item.key}
                    item={item}
                    className={`fade-slide-up stagger-${Math.min(index + 1, 3)}`}
                  />
                ))}
              </div>
            )}

            <div className="flex justify-center">
              <a
                href={new URL("/newsroom", CSMJU_SITE_URL).toString()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-5 py-3 text-label-md text-primary shadow-sm transition-colors hover:bg-surface-container-low"
              >
                ดูข่าวทั้งหมดบน csmju.com
                <OpenInNewIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * Visitors here are signed out, so a news item leads to sign-in first. Our
 * own announcements come back to the item afterwards; csmju.com items cannot
 * (`next` only accepts paths on this site), so those land on the home page.
 */
function NewsLink({
  item,
  className,
  children,
}: {
  item: NewsItem;
  className: string;
  children: React.ReactNode;
}) {
  const href = item.external
    ? "/login"
    : `/login?next=${encodeURIComponent(item.href)}`;
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function ItemMeta({ item }: { item: NewsItem }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-caption text-on-surface-variant">
      {item.category && (
        <span className="rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary">
          {item.category}
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <CalendarTodayIcon className="h-3.5 w-3.5" />
        {formatDate(item.date)}
      </span>
    </div>
  );
}

const THUMBNAIL_CLASS =
  "object-cover transition-transform duration-300 group-hover:scale-[1.03]";

function Thumbnail({
  item,
  sizes,
  priority = false,
}: {
  item: NewsItem;
  sizes: string;
  priority?: boolean;
}) {
  if (!item.imageUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-container text-outline">
        <CampaignIcon className="h-10 w-10" />
      </div>
    );
  }
  if (!item.imageFromCsmju) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served by our own image proxy, not next/image
      <img
        src={item.imageUrl}
        alt=""
        className={`absolute inset-0 h-full w-full ${THUMBNAIL_CLASS}`}
      />
    );
  }
  return (
    <Image
      src={item.imageUrl}
      alt=""
      fill
      sizes={sizes}
      priority={priority}
      className={THUMBNAIL_CLASS}
    />
  );
}

function FeaturedItem({ item }: { item: NewsItem }) {
  return (
    <NewsLink
      item={item}
      className="fade-slide-up group grid overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_4px_12px_rgba(33,84,217,0.1)] transition-shadow hover:shadow-[0_8px_24px_rgba(33,84,217,0.15)] md:grid-cols-5"
    >
      <div className="relative aspect-[16/9] overflow-hidden md:col-span-3 md:aspect-auto md:min-h-80">
        <Thumbnail item={item} sizes="(min-width: 768px) 60vw, 100vw" priority />
      </div>
      <div className="flex flex-col gap-4 p-6 md:col-span-2 md:p-8">
        <span className="w-fit rounded-full bg-[#F59E0B]/15 px-3 py-1 text-label-sm text-[#B45309]">
          ข่าวล่าสุด
        </span>
        <h2 className="line-clamp-3 font-display text-headline-md text-on-surface group-hover:text-primary">
          {item.title}
        </h2>
        <ItemMeta item={item} />
        {item.content && item.content !== item.title && (
          <p className="line-clamp-4 text-body-md text-on-surface-variant">
            {item.content}
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1 text-label-md text-primary">
          อ่านต่อ
          <ArrowForwardIcon className="h-4 w-4" />
        </span>
      </div>
    </NewsLink>
  );
}

function NewsCard({
  item,
  className = "",
}: {
  item: NewsItem;
  className?: string;
}) {
  return (
    <NewsLink
      item={item}
      className={`group flex flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-[0_8px_24px_rgba(33,84,217,0.12)] ${className}`}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <Thumbnail
          item={item}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <ItemMeta item={item} />
        <h3 className="line-clamp-2 text-body-md font-semibold text-on-surface group-hover:text-primary">
          {item.title}
        </h3>
        {item.content && item.content !== item.title && (
          <p className="line-clamp-2 text-label-md font-normal text-on-surface-variant">
            {item.content}
          </p>
        )}
      </div>
    </NewsLink>
  );
}

function NewsUnavailable({ failed }: { failed: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
        <CampaignIcon className="h-6 w-6" />
      </span>
      <p className="font-display text-headline-md text-on-surface">
        {failed ? "ไม่สามารถโหลดข่าวสารได้ในขณะนี้" : "ยังไม่มีข่าวสาร"}
      </p>
      <p className="max-w-md text-body-md text-on-surface-variant">
        {failed
          ? "กรุณาลองใหม่อีกครั้งภายหลัง หรือติดตามข่าวได้โดยตรงที่ csmju.com"
          : "เมื่อสาขาวิชาเผยแพร่ข่าวใหม่ จะแสดงที่นี่"}
      </p>
    </div>
  );
}
