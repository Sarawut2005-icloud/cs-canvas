"use client";

import { SearchIcon } from "./icons";

/** Thai-aware, case-insensitive "does any text contain the query". */
export function matchesQuery(query: string, ...texts: (string | null | undefined)[]): boolean {
  const q = query.trim().toLocaleLowerCase("th");
  if (!q) return true;
  return texts.some((t) => (t ?? "").toLocaleLowerCase("th").includes(q));
}

/**
 * A search box that filters a list already on the page, as you type — for
 * short lists loaded whole (monitor, csmju.com items, news). Long lists use
 * a GET form that filters at the API instead (ListSearch).
 */
export default function FilterBox({
  value,
  onChange,
  label,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">{label}</span>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-outline-variant bg-surface-container-lowest py-2.5 pl-10 pr-4 text-body-md focus:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container"
      />
    </label>
  );
}
