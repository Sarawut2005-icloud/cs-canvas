"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowBackIcon, ArrowForwardIcon } from "../components/icons";
import type { CsmjuBanner } from "../lib/csmju-news";

/** How long each banner stays on screen before the slider moves on. */
const AUTO_ADVANCE_MS = 6000;

/**
 * Slider for the csmju.com home-page banners. The posters are portrait-ish
 * (4:3), so each one is shown whole over a blurred copy of itself instead of
 * being cropped to fill the wide frame.
 */
export default function BannerCarousel({
  banners,
}: {
  banners: CsmjuBanner[];
}) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const timer = setInterval(
      () => setCurrent((index) => (index + 1) % count),
      AUTO_ADVANCE_MS,
    );
    return () => clearInterval(timer);
  }, [count, paused]);

  if (count === 0) return null;

  const go = (step: number) =>
    setCurrent((index) => (index + step + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="ประชาสัมพันธ์"
      className="fade-slide-up group relative overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container shadow-[0_4px_12px_rgba(33,84,217,0.1)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative aspect-[4/3] sm:aspect-[21/9]">
        {banners.map((banner, index) => (
          <BannerSlide
            key={banner.id}
            banner={banner}
            active={index === current}
            priority={index === 0}
            label={`${index + 1} จาก ${count}`}
          />
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="แบนเนอร์ก่อนหน้า"
            className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-100 backdrop-blur transition-opacity hover:bg-black/60 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          >
            <ArrowBackIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="แบนเนอร์ถัดไป"
            className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-100 backdrop-blur transition-opacity hover:bg-black/60 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          >
            <ArrowForwardIcon className="h-5 w-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full bg-black/30 px-3 py-2 backdrop-blur">
            {banners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => setCurrent(index)}
                aria-label={`ไปที่ ${banner.title}`}
                aria-current={index === current}
                className={`h-2 rounded-full transition-all ${
                  index === current ? "w-6 bg-white" : "w-2 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BannerSlide({
  banner,
  active,
  priority,
  label,
}: {
  banner: CsmjuBanner;
  active: boolean;
  priority: boolean;
  label: string;
}) {
  const content = (
    <>
      <Image
        src={banner.imageUrl}
        alt=""
        fill
        sizes="(min-width: 1152px) 1152px, 100vw"
        className="scale-110 object-cover opacity-60 blur-2xl"
      />
      <Image
        src={banner.imageUrl}
        alt={banner.title}
        fill
        sizes="(min-width: 1152px) 1152px, 100vw"
        priority={priority}
        className="object-contain"
      />
    </>
  );

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      aria-hidden={!active}
      className={`absolute inset-0 transition-opacity duration-700 ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {banner.href ? (
        <a
          href={banner.href}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={active ? 0 : -1}
          className="relative block h-full w-full"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}
