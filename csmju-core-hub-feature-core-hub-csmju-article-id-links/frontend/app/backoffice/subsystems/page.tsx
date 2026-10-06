import type { Metadata } from "next";
import Link from "next/link";
import {
  AddIcon,
  ArrowForwardIcon,
  SearchIcon,
} from "../../components/icons";
import {
  getCurrentUser,
  getSubsystemSummary,
  listSubsystems,
  type PageMeta,
  type Subsystem,
  type SubsystemSummary,
} from "../../lib/api";
import { formatDate, formatNumber } from "../../lib/format";
import {
  LIST_TABS,
  TAB_FILTER,
  capabilitiesFor,
  parseTab,
  type ListTab,
} from "../../lib/subsystems";
import PageHeader from "../_components/PageHeader";
import {
  cardClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  tdClass,
  thClass,
} from "../_components/ui";
import LinkTabs from "./_components/LinkTabs";
import { EmptyState, ErrorState } from "./_components/StateViews";
import SubsystemBadges from "./_components/SubsystemBadges";

export const metadata: Metadata = {
  title: "ระบบย่อย · BackOffice · CSMJU",
};

const PAGE_SIZE = 20;

const TAB_COUNT: Record<ListTab, keyof SubsystemSummary> = {
  all: "total",
  pending: "pending",
  active: "active",
  inactive: "inactive",
  suspended: "suspended",
  rejected: "rejected",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function listHref(tab: ListTab, q?: string, page?: number) {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("tab", tab);
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/backoffice/subsystems${query ? `?${query}` : ""}`;
}

export default async function SubsystemsPage({
  searchParams,
}: PageProps<"/backoffice/subsystems">) {
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const q = first(params.q)?.trim() ?? "";
  const page = Math.max(1, Number(first(params.page)) || 1);

  const user = await getCurrentUser();
  const caps = capabilitiesFor(user?.role ?? "staff", user?.permissions);

  let summary: SubsystemSummary;
  let rows: Subsystem[];
  let meta: PageMeta;

  try {
    [summary, { data: rows, meta }] = await Promise.all([
      getSubsystemSummary(),
      listSubsystems({ ...TAB_FILTER[tab], q, page, limit: PAGE_SIZE }),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="ระบบย่อย" description="จัดการระบบย่อยที่เชื่อมต่อกับ Core Hub" />
        <ErrorState error={error} />
      </>
    );
  }

  const stats = [
    { label: "ทั้งหมด", value: summary.total, tab: "all" as const },
    { label: "รออนุมัติ", value: summary.pending, tab: "pending" as const },
    { label: "เปิดใช้งาน", value: summary.active, tab: "active" as const },
    {
      label: "ปิดใช้งาน / ระงับ",
      value: summary.inactive + summary.suspended,
      tab: "inactive" as const,
    },
  ];

  const pendingRequests =
    summary.pending + summary.pendingExceptions + (summary.pendingChangeRequests ?? 0);

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <PageHeader
          title="ระบบย่อย"
          description={
            caps.readAny
              ? "จัดการระบบย่อยทั้งหมดที่เชื่อมต่อกับ Core Hub"
              : "ระบบย่อยที่คุณเป็นเจ้าของ และคำขอขึ้นระบบที่คุณส่งไว้"
          }
        />
        <div className="fade-slide-up flex flex-wrap gap-3">
          {caps.review && (
            <Link
              href="/backoffice/subsystems/requests"
              className={`${secondaryButtonClass} inline-flex items-center gap-2`}
            >
              คำขอที่รอดำเนินการ
              <span className="rounded-full bg-primary-container/10 px-2 py-0.5 text-label-sm tabular-nums text-primary-container">
                {formatNumber(pendingRequests)}
              </span>
            </Link>
          )}
          {caps.create && (
            <Link href="/backoffice/subsystems/new" className={primaryButtonClass}>
              <AddIcon className="h-4 w-4" />
              ส่งคำขอขึ้นระบบ
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {stats.map(({ label, value, tab: target }, index) => (
          <Link
            key={label}
            href={listHref(target)}
            className={`fade-slide-up stagger-${Math.min(index + 1, 3)} flex flex-col justify-between gap-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm transition-shadow hover:shadow-md`}
          >
            <span className="text-label-md text-on-surface-variant">{label}</span>
            <span className="font-display text-headline-lg tabular-nums text-primary-container">
              {formatNumber(value)}
            </span>
          </Link>
        ))}
      </div>

      <div className={`fade-slide-up stagger-2 ${cardClass}`}>
        <div className="flex flex-col gap-4 border-b border-outline-variant/40 px-6 pt-5 pb-4">
          <form
            role="search"
            action="/backoffice/subsystems"
            className="flex flex-col gap-3 md:flex-row md:items-center"
          >
            {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
            <div className="relative flex-1">
              <label htmlFor="subsystem-search" className="sr-only">
                ค้นหาระบบย่อย
              </label>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-outline" />
              <input
                id="subsystem-search"
                name="q"
                defaultValue={q}
                placeholder="ค้นหาจากชื่อระบบหรือชื่อที่แสดง"
                className={`${inputClass} pl-10`}
              />
            </div>
            <button type="submit" className={secondaryButtonClass}>
              ค้นหา
            </button>
          </form>
          <LinkTabs
            label="กรองตามสถานะ"
            active={tab}
            hrefFor={(id) => listHref(id, q)}
            tabs={LIST_TABS.map((t) => ({ ...t, count: summary[TAB_COUNT[t.id]] }))}
          />
        </div>

        {rows.length === 0 ? (
          q || tab !== "all" ? (
            <EmptyState
              Icon={SearchIcon}
              title="ไม่พบระบบย่อยที่ตรงกับเงื่อนไข"
              description="ลองเปลี่ยนคำค้นหาหรือเลือกสถานะอื่น"
              action={
                <Link href="/backoffice/subsystems" className={secondaryButtonClass}>
                  ล้างตัวกรอง
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="ยังไม่มีระบบย่อย"
              description={
                caps.readAny
                  ? "ยังไม่มีระบบย่อยลงทะเบียนกับ Core Hub"
                  : "เริ่มต้นด้วยการส่งคำขอขึ้นระบบย่อยของทีมคุณ"
              }
              action={
                caps.create ? (
                  <Link href="/backoffice/subsystems/new" className={primaryButtonClass}>
                    <AddIcon className="h-4 w-4" />
                    ส่งคำขอขึ้นระบบ
                  </Link>
                ) : undefined
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                  <th scope="col" className={thClass}>ระบบย่อย</th>
                  {caps.readAny && <th scope="col" className={thClass}>เจ้าของ</th>}
                  <th scope="col" className={thClass}>สถานะ</th>
                  <th scope="col" className={thClass}>ส่งคำขอเมื่อ</th>
                  <th scope="col" className={`${thClass} text-right`}>จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-body-md">
                {rows.map((subsystem) => (
                  <tr
                    key={subsystem.id}
                    className="border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-surface/50"
                  >
                    <td className={tdClass}>
                      <p className="font-medium text-on-surface">{subsystem.displayName}</p>
                      <p className="text-label-sm text-on-surface-variant">
                        {subsystem.name} · v{subsystem.standardsVersion}
                      </p>
                    </td>
                    {caps.readAny && (
                      <td className={`${tdClass} text-on-surface-variant`}>
                        {subsystem.owner?.username ?? subsystem.owner?.email ?? "—"}
                      </td>
                    )}
                    <td className={tdClass}>
                      <SubsystemBadges subsystem={subsystem} />
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-on-surface-variant`}>
                      {formatDate(subsystem.createdAt)}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Link
                        href={`/backoffice/subsystems/${encodeURIComponent(subsystem.id)}`}
                        aria-label={`ดูรายละเอียด ${subsystem.displayName}`}
                        className="inline-flex items-center gap-1 whitespace-nowrap text-label-md text-primary-container hover:underline"
                      >
                        ดูรายละเอียด
                        <ArrowForwardIcon className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta.totalPages > 1 && (
          <nav
            aria-label="เปลี่ยนหน้า"
            className="flex items-center justify-between gap-3 border-t border-outline-variant/40 px-6 py-4 text-label-md text-on-surface-variant"
          >
            <span className="tabular-nums">
              หน้า {formatNumber(meta.page)} จาก {formatNumber(meta.totalPages)} ·{" "}
              {formatNumber(meta.total)} รายการ
            </span>
            <span className="flex gap-2">
              {meta.page > 1 && (
                <Link href={listHref(tab, q, meta.page - 1)} className={secondaryButtonClass}>
                  ก่อนหน้า
                </Link>
              )}
              {meta.page < meta.totalPages && (
                <Link href={listHref(tab, q, meta.page + 1)} className={secondaryButtonClass}>
                  ถัดไป
                </Link>
              )}
            </span>
          </nav>
        )}
      </div>
    </>
  );
}
