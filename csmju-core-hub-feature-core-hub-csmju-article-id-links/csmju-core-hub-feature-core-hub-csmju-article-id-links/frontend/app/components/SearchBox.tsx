"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "./icons";

export type SearchHit = { href: string; title: string; detail: string };
export type SearchGroup = { label: string; hits: SearchHit[] };

/** Wait this long after the last key before asking the API. */
const DEBOUNCE_MS = 350;

/**
 * A site-wide search box with grouped results. `search` is a server action
 * that decides what can be found — and only finds what the signed-in user
 * (or, on the public site, anyone) may read. Arrow keys move through the
 * results, Enter opens one, Escape closes the list.
 *
 * Hits inside this app use the router; a subsystem's /sso/authorize or
 * another site's page is a real navigation (another site in a new tab).
 */
export default function SearchBox({
  search,
  label,
  placeholder,
  className = "",
}: {
  search: (query: string) => Promise<SearchGroup[]>;
  /** Accessible name of the input — what can be searched. */
  label: string;
  placeholder: string;
  className?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const latest = useRef(0);

  const hits = groups.flatMap((g) => g.hits);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await search(trimmed).catch(() => []);
      // Only the answer to the newest query counts.
      if (ticket !== latest.current) return;
      setGroups(result);
      setActive(0);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, search]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    setGroups([]);
    if (/^https?:\/\//.test(href)) {
      window.open(href, "_blank", "noopener,noreferrer");
    } else if (href.startsWith("/sso/")) {
      // The SSO handoff leaves this app: a full navigation, not the router.
      window.location.assign(href);
    } else {
      router.push(href);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (hits.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(hits[Math.min(active, hits.length - 1)].href);
    }
  };

  const showList = open && trimmed.length >= 2;
  let index = -1;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
      <input
        type="search"
        role="combobox"
        aria-label={label}
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && hits.length > 0 ? `${listId}-${active}` : undefined}
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-full border border-outline-variant/50 bg-surface py-2.5 pl-10 pr-4 text-body-md transition-colors focus:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container"
      />

      {showList && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-surface-variant bg-surface-container-lowest py-2 shadow-xl"
        >
          {loading && groups.length === 0 ? (
            <p className="px-4 py-3 text-body-md text-on-surface-variant">กำลังค้นหา...</p>
          ) : groups.length === 0 ? (
            <p className="px-4 py-3 text-body-md text-on-surface-variant">
              ไม่พบผลลัพธ์สำหรับ &ldquo;{trimmed}&rdquo;
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.label} role="group" aria-label={g.label}>
                <p className="px-4 pb-1 pt-2 text-caption font-semibold text-on-surface-variant">
                  {g.label}
                </p>
                {g.hits.map((hit) => {
                  index += 1;
                  const i = index;
                  return (
                    <button
                      key={hit.href + hit.title}
                      id={`${listId}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(hit.href)}
                      className={`block w-full px-4 py-2 text-left ${
                        i === active ? "bg-primary-container/10" : "hover:bg-surface-container"
                      }`}
                    >
                      <span className="block truncate text-label-md text-on-surface">{hit.title}</span>
                      <span className="block truncate text-caption text-on-surface-variant">{hit.detail}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
