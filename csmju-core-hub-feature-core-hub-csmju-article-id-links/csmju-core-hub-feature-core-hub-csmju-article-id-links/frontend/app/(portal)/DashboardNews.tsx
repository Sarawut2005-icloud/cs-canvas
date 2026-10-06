"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CalendarTodayIcon, CampaignIcon } from "../components/icons";
import { formatDate } from "../lib/format";
import type { NewsItem } from "../welcome/news-items";
import RetryButton from "../components/RetryButton";

/** Cards added each time the reader reaches the end of the list. */
const PAGE_SIZE = 5;

function Thumbnail({ item, sizes }: { item: NewsItem; sizes: string }) {
  const className = "object-cover transition-transform duration-300 group-hover:scale-[1.03]";
  if (!item.imageUrl) {
    return (
      <div className="brand-gradient flex h-full w-full items-center justify-center">
        <CampaignIcon className="h-12 w-12 text-white/25" />
      </div>
    );
  }
  if (!item.imageFromCsmju) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served by our own image proxy, not next/image
      <img src={item.imageUrl} alt="" className={`absolute inset-0 h-full w-full ${className}`} />
    );
  }
  return <Image src={item.imageUrl} alt="" fill sizes={sizes} className={className} />;
}

function NewsLink({
  item,
  className,
  children,
}: {
  item: NewsItem;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={item.href}
      {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={className}
    >
      {children}
    </a>
  );
}

function Meta({ item }: { item: NewsItem }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-caption text-secondary">
      {item.category && (
        <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-caption font-semibold text-white">
          {item.category}
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <CalendarTodayIcon className="h-4 w-4" />
        {formatDate(item.date)}
      </span>
    </p>
  );
}

/**
 * The newest item large on top, then everything else as a list that keeps
 * growing while the reader scrolls down.
 */
export default function DashboardNews({
  items,
  failed = false,
}: {
  items: NewsItem[];
  /** csmju.com could not be reached; with nothing else to show, say so. */
  failed?: boolean;
}) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [latest, ...rest] = items;
  const hasMore = shown < rest.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown((n) => Math.min(n + PAGE_SIZE, rest.length));
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, rest.length]);

  if (!latest) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 text-center">
        <CampaignIcon className="h-8 w-8 text-outline" />
        <p className="text-body-md text-on-surface-variant">
          {failed
            ? "เชื่อมต่อเซิร์ฟเวอร์ข่าวไม่ได้ กรุณาลองอีกครั้งในภายหลัง"
            : "ยังไม่มีข่าวสารในขณะนี้"}
        </p>
        {failed && <RetryButton />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <NewsLink
        item={latest}
        className="group grid overflow-hidden rounded-xl border border-surface-variant bg-surface-container-lowest transition-shadow hover:shadow-md md:grid-cols-2"
      >
        <div className="relative aspect-[16/9] overflow-hidden md:aspect-auto md:min-h-56">
          <Thumbnail item={latest} sizes="(min-width: 1280px) 30vw, (min-width: 768px) 50vw, 100vw" />
          <span className="absolute left-4 top-4 rounded-full bg-warning px-3 py-1 text-caption font-semibold text-white">
            ข่าวล่าสุด
          </span>
        </div>
        <div className="flex flex-col gap-3 p-6">
          <Meta item={latest} />
          <h4 className="line-clamp-3 font-display text-[20px] font-bold leading-tight text-on-surface group-hover:text-primary-container">
            {latest.title}
          </h4>
          {latest.content && latest.content !== latest.title && (
            <p className="line-clamp-3 text-body-md text-on-surface-variant">{latest.content}</p>
          )}
        </div>
      </NewsLink>

      {rest.slice(0, shown).map((item) => (
        <NewsLink
          key={item.key}
          item={item}
          className="fade-slide-up group flex gap-4 overflow-hidden rounded-xl border border-surface-variant bg-surface-container-lowest p-3 transition-shadow hover:shadow-md"
        >
          <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-lg sm:w-40">
            <Thumbnail item={item} sizes="160px" />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 py-1">
            <Meta item={item} />
            <h4 className="line-clamp-2 text-label-md font-bold text-on-surface group-hover:text-primary-container">
              {item.title}
            </h4>
            {item.content && item.content !== item.title && (
              <p className="line-clamp-2 text-[14px] text-on-surface-variant">{item.content}</p>
            )}
          </div>
        </NewsLink>
      ))}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-2">
          <button
            type="button"
            onClick={() => setShown((n) => Math.min(n + PAGE_SIZE, rest.length))}
            className="rounded-lg px-4 py-2 text-label-md text-primary-container hover:bg-primary-container/10"
          >
            แสดงข่าวเพิ่มเติม
          </button>
        </div>
      )}
    </div>
  );
}
