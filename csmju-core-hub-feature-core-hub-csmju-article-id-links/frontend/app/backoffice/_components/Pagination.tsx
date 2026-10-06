import Link from "next/link";
import { ArrowBackIcon, ArrowForwardIcon } from "../../components/icons";
import type { PageMeta } from "../../lib/api";
import { formatNumber } from "../../lib/format";
import PageSizeSelect from "./PageSizeSelect";
import { secondaryButtonClass } from "./ui";

/** Builds `basePath?…&page=n`, keeping every other filter in `params`. */
export function pageHref(
  basePath: string,
  params: Record<string, string | number | undefined>,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && key !== "page") {
      search.set(key, String(value));
    }
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Server-rendered pager driven by the API's `meta` — works without JS and
 * keeps the current filters in the URL so a page can be shared.
 */
export default function Pagination({
  meta,
  basePath,
  params,
  itemLabel = "รายการ",
}: {
  meta: PageMeta;
  basePath: string;
  params: Record<string, string | number | undefined>;
  itemLabel?: string;
}) {
  const { page, totalPages, total, limit } = meta;
  if (total === 0) return null;

  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  const disabled = "pointer-events-none opacity-40";

  return (
    <nav
      aria-label="แบ่งหน้า"
      className="flex flex-col gap-3 border-t border-outline-variant/40 px-6 py-4 text-label-md text-on-surface-variant md:flex-row md:items-center md:justify-between"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <PageSizeSelect value={limit} />
        <p>
          แสดง {formatNumber(first)}–{formatNumber(last)} จาก {formatNumber(total)} {itemLabel}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={pageHref(basePath, params, page - 1)}
          aria-disabled={page <= 1}
          className={`${secondaryButtonClass} inline-flex items-center gap-1 ${page <= 1 ? disabled : ""}`}
        >
          <ArrowBackIcon className="h-4 w-4" />
          ก่อนหน้า
        </Link>
        <span className="px-2 tabular-nums">
          หน้า {page} / {Math.max(totalPages, 1)}
        </span>
        <Link
          href={pageHref(basePath, params, page + 1)}
          aria-disabled={page >= totalPages}
          className={`${secondaryButtonClass} inline-flex items-center gap-1 ${page >= totalPages ? disabled : ""}`}
        >
          ถัดไป
          <ArrowForwardIcon className="h-4 w-4" />
        </Link>
      </div>
    </nav>
  );
}
