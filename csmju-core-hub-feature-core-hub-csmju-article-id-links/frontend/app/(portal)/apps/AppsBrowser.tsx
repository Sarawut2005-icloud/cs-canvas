"use client";

import { useState } from "react";
import { AppsIcon, OpenInNewIcon, SearchIcon } from "../../components/icons";
import type { DirectoryEntry } from "../../lib/api";
import { groupByCategory } from "../../lib/subsystems";

/** Thai-aware, case-insensitive match on name, display name and description. */
function matches(entry: DirectoryEntry, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("th");
  if (!q) return true;
  return [entry.displayName, entry.name, entry.description ?? ""].some((text) =>
    text.toLocaleLowerCase("th").includes(q),
  );
}

/**
 * Cards of the subsystems the user may enter, grouped by category, with a
 * search box. The list comes from GET /subsystems/directory, so it already
 * holds only what the user's role (or an approved exception) opens.
 */
export default function AppsBrowser({ subsystems }: { subsystems: DirectoryEntry[] }) {
  const [query, setQuery] = useState("");
  const found = subsystems.filter((s) => matches(s, query));
  const groups = groupByCategory(found);

  return (
    <div className="flex flex-col gap-8">
      <div className="relative max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
        <label htmlFor="apps-search" className="sr-only">
          ค้นหาระบบย่อย
        </label>
        <input
          id="apps-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหาจากชื่อหรือคำอธิบาย"
          className="w-full rounded-full border border-outline-variant bg-surface-container-lowest py-2.5 pl-10 pr-4 text-body-md focus:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container"
        />
      </div>

      {subsystems.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 text-center">
          <AppsIcon className="h-8 w-8 text-outline" />
          <p className="text-body-md text-on-surface-variant">
            ยังไม่มีระบบย่อยที่บัญชีนี้เข้าใช้งานได้
          </p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 text-center">
          <p className="text-body-md text-on-surface-variant">ไม่พบระบบย่อยที่ตรงกับ &ldquo;{query}&rdquo;</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-lg px-3 py-1.5 text-label-md text-primary-container hover:bg-primary-container/10"
          >
            ล้างคำค้นหา
          </button>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.value} aria-labelledby={`cat-${group.value}`}>
            <h3
              id={`cat-${group.value}`}
              className="mb-3 flex items-center gap-2 border-l-4 border-primary-container pl-3 font-display text-label-md font-bold text-on-surface"
            >
              {group.label}
              <span className="text-caption font-normal text-on-surface-variant">{group.entries.length} ระบบ</span>
            </h3>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.entries.map((s) => (
                <li key={s.id}>
                  <a
                    href={`/sso/authorize?subsystem=${encodeURIComponent(s.name)}`}
                    className="group flex h-full items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container/10 font-display text-label-md font-bold uppercase text-primary-container">
                      {s.displayName.trim().charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-label-md text-on-surface group-hover:text-primary-container">
                        {s.displayName}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-caption text-on-surface-variant">
                        {s.description ?? s.name}
                      </span>
                    </span>
                    <OpenInNewIcon className="h-4 w-4 shrink-0 text-outline opacity-0 transition-opacity group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
