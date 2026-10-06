import type { Metadata } from "next";
import { getNewsFeed } from "../../lib/news-feed";
import NewsBrowser from "./NewsBrowser";

export const metadata: Metadata = {
  title: "ข่าวสาร · CSMJU",
};

/**
 * Most items loaded at once. The department's announcements are capped at
 * 50 by GET /published-announcements; csmju.com articles follow the same
 * number. The page reveals them while scrolling.
 */
const NEWS_LIMIT = 50;

/**
 * Every news item for signed-in users: the department's announcements and
 * csmju.com news, newest first, minus what admins hid — the same feed as
 * the front page and the dashboard.
 */
export default async function NewsPage() {
  const { items, failed } = await getNewsFeed(NEWS_LIMIT);

  return (
    <>
      <div className="fade-slide-up mb-8">
        <h2 className="mb-2 font-display text-headline-md font-bold text-on-surface md:text-headline-lg">
          ข่าวสาร
        </h2>
        <p className="text-body-lg text-on-surface-variant">
          ประกาศของสาขาวิชาและข่าวจากเว็บไซต์ csmju.com
        </p>
      </div>

      <div className="fade-slide-up stagger-1">
        <NewsBrowser items={items} failed={failed} />
      </div>
    </>
  );
}
