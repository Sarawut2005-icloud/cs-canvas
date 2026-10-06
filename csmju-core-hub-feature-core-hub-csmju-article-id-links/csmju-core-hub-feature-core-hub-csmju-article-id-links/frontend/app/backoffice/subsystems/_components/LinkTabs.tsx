import Link from "next/link";

/**
 * Tabs whose selection lives in the URL (`?tab=`), so a refresh or a shared
 * link lands on the same view. Styled like `_components/Tabs`.
 */
export default function LinkTabs<T extends string>({
  tabs,
  active,
  hrefFor,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  hrefFor: (id: T) => string;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="flex gap-1 overflow-x-auto border-b border-outline-variant/40"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={hrefFor(tab.id)}
            aria-current={selected ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-label-md transition-colors ${
              selected
                ? "border-primary-container text-primary-container"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-label-sm tabular-nums ${
                  selected
                    ? "bg-primary-container/10 text-primary-container"
                    : "bg-surface-variant text-on-surface-variant"
                }`}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
