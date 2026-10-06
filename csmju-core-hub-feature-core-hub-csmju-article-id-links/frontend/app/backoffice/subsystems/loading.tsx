/** Skeleton while subsystem pages load (ui-design-system.md §9.1). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">กำลังโหลดข้อมูล...</span>
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-container" />
        <div className="h-5 w-80 max-w-full animate-pulse rounded-lg bg-surface-container" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-container" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-outline-variant/40 px-6 py-4 last:border-0">
            <div className="h-5 flex-1 animate-pulse rounded bg-surface-container" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-surface-container" />
            <div className="h-5 w-20 animate-pulse rounded bg-surface-container" />
          </div>
        ))}
      </div>
    </div>
  );
}
