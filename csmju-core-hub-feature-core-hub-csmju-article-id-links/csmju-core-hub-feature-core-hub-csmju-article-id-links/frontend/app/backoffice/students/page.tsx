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
import { ErrorState } from "../subsystems/_components/StateViews";
import ExportButton from "../people/ExportButton";
import ImportButton from "../people/ImportButton";
import { loadPeopleFormOptions } from "../people/form-options";
import AddStudentsButton from "./AddStudentsButton";
import StudentsTable from "./StudentsTable";

export const metadata: Metadata = {
  title: "นักศึกษา · BackOffice · CSMJU",
};

type Filters = {
  q: string;
  entryYear: string;
  status: PersonStatus | "ALL";
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function parseStatus(value: string): Filters["status"] {
  const upper = value.toUpperCase();
  if (upper === "ALL") return "ALL";
  return (PERSON_STATUSES as string[]).includes(upper)
    ? (upper as PersonStatus)
    : "ACTIVE";
}

/**
 * Student directory from the people registry — staff, lecturers and admins
 * read it; staff and admins export it (people:export); admins add and import.
 */
export default async function StudentsPage({
  searchParams,
}: PageProps<"/backoffice/students">) {
  const params = await searchParams;
  const filters: Filters = {
    q: first(params.q).trim(),
    entryYear: first(params.entryYear).trim(),
    status: parseStatus(first(params.status)),
  };
  const page = parsePage(params.page);
  const limit = parseLimit(params.limit);

  const user = await getCurrentUser();
  // UI only — the Core API checks people:manage / people:export on every call.
  const canManage = user?.role === "admin";
  const canExport = user?.role === "admin" || user?.role === "staff";
  const formOptions = canManage ? await loadPeopleFormOptions() : null;

  let students: Person[] = [];
  let meta: PageMeta = { total: 0, page, limit, totalPages: 0 };
  let error: unknown = null;

  try {
    const result = await listPeople({
      personType: "STUDENT",
      q: filters.q || undefined,
      entryYear: filters.entryYear || undefined,
      status: filters.status,
      page,
      limit,
    });
    students = result.data;
    meta = result.meta;
  } catch (err) {
    error = err;
  }

  const queryParams = {
    q: filters.q || undefined,
    entryYear: filters.entryYear || undefined,
    status: filters.status !== "ACTIVE" ? filters.status : undefined,
    limit: limit !== DEFAULT_PAGE_SIZE ? limit : undefined,
  };

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <PageHeader
          title="นักศึกษา"
          description="ทะเบียนนักศึกษาจากข้อมูลกลาง — ค้นหา กรองตามปีเข้าและสถานะ และดูอาจารย์ที่ปรึกษา"
        />
        {(canManage || canExport) && (
          <div className="fade-slide-up flex flex-wrap items-start gap-3 self-start md:self-auto">
            {canExport && (
              <ExportButton
                fileName={`students${filters.entryYear ? `-${filters.entryYear}` : ""}.csv`}
                filters={{
                  personType: "STUDENT",
                  status: filters.status,
                  entryYear: filters.entryYear || undefined,
                  q: filters.q || undefined,
                }}
              />
            )}
            {canManage && <ImportButton />}
            {canManage && formOptions && <AddStudentsButton options={formOptions} />}
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
                defaultValue={filters.q}
                placeholder="ค้นหารหัสนักศึกษาหรือชื่อ"
                className={`${inputClass} pl-10`}
              />
            </label>
            <label className="block space-y-1 md:w-36">
              <span className="text-label-sm text-on-surface-variant">ปีเข้า (พ.ศ.)</span>
              <input
                name="entryYear"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={filters.entryYear}
                placeholder="เช่น 2567"
                className={inputClass}
              />
            </label>
            <label className="block space-y-1 md:w-52">
              <span className="text-label-sm text-on-surface-variant">สถานะ</span>
              <select name="status" defaultValue={filters.status} className={inputClass}>
                <option value="ALL">ทุกสถานะ</option>
                {PERSON_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PERSON_STATUS_BADGE[status].label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="submit" className={primaryButtonClass}>
                ค้นหา
              </button>
              {(filters.q || filters.entryYear || filters.status !== "ACTIVE") && (
                <Link href="/backoffice/students" className={secondaryButtonClass}>
                  ล้างตัวกรอง
                </Link>
              )}
            </div>
          </form>

          <StudentsTable students={students} canManage={canManage} />

          <Pagination
            meta={meta}
            basePath="/backoffice/students"
            params={queryParams}
            itemLabel="คน"
          />
        </div>
      )}
    </>
  );
}
