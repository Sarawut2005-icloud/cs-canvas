import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "../../components/icons";
import {
  getCurrentUser,
  listPeople,
  type PageMeta,
  type Person,
  type PersonStatus,
} from "../../lib/api";
import { PERSON_STATUS_BADGE, PERSON_STATUSES } from "../../lib/people";
import { DEFAULT_PAGE_SIZE, parseLimit, parsePage } from "../../lib/paging";
import PageHeader from "../_components/PageHeader";
import Pagination from "../_components/Pagination";
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from "../_components/ui";
import ImportButton from "../people/ImportButton";
import { loadPeopleFormOptions } from "../people/form-options";
import { ErrorState } from "../subsystems/_components/StateViews";
import AddStaffButton from "./AddStaffButton";
import StaffTable from "./StaffTable";

export const metadata: Metadata = {
  title: "บุคลากร · BackOffice · CSMJU",
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function parseStatus(value: string): PersonStatus | "ALL" {
  const upper = value.toUpperCase();
  if (upper === "ALL") return "ALL";
  return (PERSON_STATUSES as string[]).includes(upper) ? (upper as PersonStatus) : "ACTIVE";
}

/**
 * Staff directory from the people registry (`people:read`). Admins add a
 * person, import a CSV, and open a row to change its status (handoff ข.2).
 */
export default async function FacultyPage({ searchParams }: PageProps<"/backoffice/faculty">) {
  const params = await searchParams;
  const q = first(params.q).trim();
  const status = parseStatus(first(params.status));
  const page = parsePage(params.page);
  const limit = parseLimit(params.limit);

  const user = await getCurrentUser();
  // UI only — the Core API checks people:manage on every write.
  const canManage = user?.role === "admin";
  const formOptions = canManage ? await loadPeopleFormOptions() : null;

  let staff: Person[] = [];
  let meta: PageMeta = { total: 0, page, limit, totalPages: 0 };
  let error: unknown = null;

  try {
    const result = await listPeople({
      personType: "STAFF",
      q: q || undefined,
      status,
      page,
      limit,
    });
    staff = result.data;
    meta = result.meta;
  } catch (err) {
    error = err;
  }

  const filtered = Boolean(q) || status !== "ACTIVE";

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <PageHeader
          title="บุคลากร"
          description="อาจารย์และเจ้าหน้าที่ของสาขาจากทะเบียนบุคลากร — ตำแหน่ง สังกัด และช่องทางติดต่อ"
        />
        {canManage && formOptions && (
          <div className="fade-slide-up flex flex-wrap items-start gap-3 self-start md:self-auto">
            <ImportButton />
            <AddStaffButton options={formOptions} />
          </div>
        )}
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : (
        <div className={`fade-slide-up stagger-1 ${cardClass}`}>
          <form
            method="get"
            className="flex flex-col gap-3 border-b border-outline-variant/40 px-6 py-5 md:flex-row md:items-end"
          >
            <label className="relative flex-1">
              <span className="sr-only">ค้นหา</span>
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="ค้นหารหัสบุคลากรหรือชื่อ"
                className={`${inputClass} pl-10`}
              />
            </label>
            <label className="block space-y-1 md:w-52">
              <span className="text-label-sm text-on-surface-variant">สถานะ</span>
              <select name="status" defaultValue={status} className={inputClass}>
                <option value="ALL">ทุกสถานะ</option>
                {PERSON_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {PERSON_STATUS_BADGE[value].label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="submit" className={primaryButtonClass}>
                ค้นหา
              </button>
              {filtered && (
                <Link href="/backoffice/faculty" className={secondaryButtonClass}>
                  ล้างตัวกรอง
                </Link>
              )}
            </div>
          </form>

          <StaffTable staff={staff} canManage={canManage} filtered={filtered} />

          <Pagination
            meta={meta}
            basePath="/backoffice/faculty"
            params={{
              q: q || undefined,
              status: status !== "ACTIVE" ? status : undefined,
              limit: limit !== DEFAULT_PAGE_SIZE ? limit : undefined,
            }}
            itemLabel="คน"
          />
        </div>
      )}
    </>
  );
}
