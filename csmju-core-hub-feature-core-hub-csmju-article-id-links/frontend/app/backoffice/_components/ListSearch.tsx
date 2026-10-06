import Link from "next/link";
import { SearchIcon } from "../../components/icons";
import { inputClass, primaryButtonClass } from "./ui";

/**
 * A list page's search box: a GET form that puts `?q=` in the URL, so the
 * server page filters through the Core API and a search can be shared or
 * reloaded. Other query values worth keeping (a tab) go in `keep`.
 */
export default function ListSearch({
  q,
  placeholder,
  clearHref,
  keep = {},
}: {
  q: string;
  placeholder: string;
  /** Where "ล้าง" goes — the page without `q`. */
  clearHref: string;
  keep?: Record<string, string>;
}) {
  return (
    <form method="get" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="relative flex-1">
        <span className="sr-only">ค้นหา</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={100}
          placeholder={placeholder}
          className={`${inputClass} pl-10`}
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass}>
          ค้นหา
        </button>
        {q && (
          <Link
            href={clearHref}
            className="rounded-lg px-3 py-2.5 text-label-md text-on-surface-variant hover:bg-surface-container"
          >
            ล้าง
          </Link>
        )}
      </div>
    </form>
  );
}
