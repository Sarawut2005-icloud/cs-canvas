"use client";

import { useState } from "react";
import { CampaignIcon } from "../../components/icons";
import type { NewsItem } from "../../welcome/news-items";
import FilterBox, { matchesQuery } from "../../components/FilterBox";
import DashboardNews from "../DashboardNews";

const ALL = "";

/**
 * Every news item with a category filter on top. The list itself is the
 * dashboard's (newest large, the rest growing while scrolling); it starts
 * over whenever the category changes.
 */
export default function NewsBrowser({
  items,
  failed,
}: {
  items: NewsItem[];
  failed: boolean;
}) {
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");

  // Categories in the order of how often they appear.
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.category) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  const categories = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const shown = items
    .filter((i) => category === ALL || i.category === category)
    .filter((i) => matchesQuery(query, i.title, i.content, i.category));

  const chip = (value: string, label: string, count: number) => {
    const active = category === value;
    return (
      <button
        key={value || "all"}
        type="button"
        onClick={() => setCategory(value)}
        aria-pressed={active}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-label-md transition-colors ${
          active
            ? "border-primary-container bg-primary-container text-white"
            : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary-container hover:text-primary-container"
        }`}
      >
        {label}
        <span className={`ml-1.5 tabular-nums ${active ? "text-white/80" : "text-outline"}`}>{count}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <FilterBox
        value={query}
        onChange={setQuery}
        label="ค้นหาข่าวสาร"
        placeholder="ค้นหาหัวข้อหรือเนื้อหาข่าว"
        className="max-w-md"
      />
      {categories.length > 1 && (
        <div role="group" aria-label="กรองตามหมวดหมู่" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {chip(ALL, "ทั้งหมด", items.length)}
          {categories.map((c) => chip(c, c, counts.get(c) ?? 0))}
        </div>
      )}

      {shown.length === 0 && items.length > 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 text-center">
          <CampaignIcon className="h-8 w-8 text-outline" />
          <p className="text-body-md text-on-surface-variant">
            {query.trim()
              ? `ไม่พบข่าวที่ตรงกับ “${query.trim()}”${category ? ` ในหมวด “${category}”` : ""}`
              : `ไม่มีข่าวในหมวด “${category}”`}
          </p>
          <button
            type="button"
            onClick={() => {
              setCategory(ALL);
              setQuery("");
            }}
            className="rounded-lg px-3 py-1.5 text-label-md text-primary-container hover:bg-primary-container/10"
          >
            ดูข่าวทั้งหมด
          </button>
        </div>
      ) : (
        <DashboardNews key={`${category}|${query.trim()}`} items={shown} failed={failed} />
      )}
    </div>
  );
}
