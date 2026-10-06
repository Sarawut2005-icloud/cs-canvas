import type { Metadata } from "next";
import { SearchIcon } from "../../components/icons";
import {
  getCurrentUser,
  listReference,
  type PageMeta,
  type ReferenceDataset,
  type ReferenceFilter,
} from "../../lib/api";
import { DEFAULT_PAGE_SIZE, parseLimit, parsePage } from "../../lib/paging";
import AutoSubmitSelect from "../_components/AutoSubmitSelect";
import PageHeader from "../_components/PageHeader";
import Pagination from "../_components/Pagination";
import { inputClass, secondaryButtonClass } from "../_components/ui";
import LinkTabs from "../subsystems/_components/LinkTabs";
import { ErrorState } from "../subsystems/_components/StateViews";
import ReferenceTable, { type ReferenceRow } from "./ReferenceTable";
import {
  DATASETS,
  DATASET_LABELS,
  DEFINITIONS,
  isDataset,
  optionsFor,
  type SelectOptions,
} from "./datasets";

export const metadata: Metadata = {
  title: "ข้อมูลอ้างอิง · BackOffice · CSMJU",
};

type ActiveMode = "active" | "inactive" | "all";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type Named = { code: string; nameTh: string };

/** Active rows of a dataset for selects — empty on failure so the page still renders. */
async function options(dataset: "faculties" | "buildings" | "departments") {
  try {
    const { data } = await listReference<Named & { isActive: boolean; updatedAt: string }>(
      dataset,
      { limit: 100 },
    );
    return data.map((row) => ({ value: row.code, label: `${row.nameTh} (${row.code})` }));
  } catch {
    return [];
  }
}

export default async function ReferencePage({
  searchParams,
}: PageProps<"/backoffice/reference">) {
  const params = await searchParams;
  const rawTab = first(params.tab);
  const tab: ReferenceDataset = isDataset(rawTab) ? rawTab : DATASETS[0];
  const def = DEFINITIONS[tab];

  // ?active= ใช้งาน (ค่าเริ่มต้น) · inactive เฉพาะที่ปิดใช้งาน · all ทั้งสองแบบ
  // (`includeInactive=true` แบบเก่าเท่ากับ all)
  const rawActive = first(params.active);
  const activeMode: ActiveMode =
    rawActive === "inactive" || rawActive === "all"
      ? rawActive
      : first(params.includeInactive) === "true"
        ? "all"
        : "active";
  const activeQuery: Pick<ReferenceFilter, "includeInactive" | "isActive"> =
    activeMode === "all"
      ? { includeInactive: true }
      : activeMode === "inactive"
        ? { includeInactive: true, isActive: false }
        : {};
  const page = parsePage(params.page);
  const limit = parseLimit(params.limit);

  // Only the filters this dataset defines reach the API (the DTO rejects others).
  const filterValues: Record<string, string> = {};
  for (const filter of def.filters) {
    const value = first(params[filter.key])?.trim();
    if (value) filterValues[filter.key] = value;
  }

  const user = await getCurrentUser();
  const canManage = user?.role === "admin";

  const selectOptions: SelectOptions = { faculties: [], buildings: [], departments: [] };
  await Promise.all(
    def.needs.map(async (source) => {
      selectOptions[source] = await options(source);
    }),
  );

  let rows: ReferenceRow[] = [];
  let meta: PageMeta | null = null;
  let loadError: unknown = null;
  try {
    const query: ReferenceFilter = { page, limit, ...activeQuery, ...filterValues };
    const result = await listReference<ReferenceRow>(tab, query);
    rows = result.data;
    meta = result.meta;
  } catch (error) {
    loadError = error;
  }

  const hrefFor = (id: ReferenceDataset) => `/backoffice/reference?tab=${id}`;
  const showInactiveHref = `/backoffice/reference?${new URLSearchParams({
    tab,
    ...filterValues,
    ...(limit !== DEFAULT_PAGE_SIZE ? { limit: String(limit) } : {}),
    active: "inactive",
  }).toString()}`;
  const pagerParams = {
    tab,
    active: activeMode !== "active" ? activeMode : undefined,
    limit: limit !== DEFAULT_PAGE_SIZE ? limit : undefined,
    ...filterValues,
  };

  return (
    <>
      <PageHeader
        title="ข้อมูลอ้างอิง"
        description="รายวิชา หลักสูตร ห้อง ภาคการศึกษา อาคาร สาขา และคณะ ที่ทุกระบบย่อยใช้ร่วมกัน · รหัสตั้งแล้วแก้ไม่ได้ และไม่มีการลบ ใช้ปิดใช้งานแทน"
      />

      <div className="fade-slide-up stagger-1">
        <LinkTabs
          tabs={DATASETS.map((id) => ({ id, label: DATASET_LABELS[id] }))}
          active={tab}
          hrefFor={hrefFor}
          label="ชุดข้อมูลอ้างอิง"
        />
      </div>

      <form
        method="get"
        className="fade-slide-up stagger-1 flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="tab" value={tab} />
        {def.filters.map((filter) => {
          const id = `filter-${filter.key}`;
          const value = filterValues[filter.key] ?? "";
          return (
            <div key={filter.key} className="min-w-40 flex-1 space-y-1.5 md:flex-none md:basis-56">
              <label htmlFor={id} className="block text-label-md text-on-surface">
                {filter.label}
              </label>
              {filter.type === "select" ? (
                <select id={id} name={filter.key} defaultValue={value} className={inputClass}>
                  <option value="">ทั้งหมด</option>
                  {optionsFor(filter.select, selectOptions).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  name={filter.key}
                  type={filter.type === "number" ? "number" : "search"}
                  defaultValue={value}
                  className={inputClass}
                />
              )}
            </div>
          );
        })}
        <div className="min-w-40 space-y-1.5 md:basis-44">
          <label htmlFor="filter-active" className="block text-label-md text-on-surface">
            สถานะ
          </label>
          <AutoSubmitSelect
            id="filter-active"
            name="active"
            defaultValue={activeMode === "active" ? "" : activeMode}
            className={inputClass}
          >
            <option value="">ใช้งานอยู่</option>
            <option value="inactive">ปิดใช้งานแล้ว</option>
            <option value="all">ทั้งหมด</option>
          </AutoSubmitSelect>
        </div>
        <button type="submit" className={`${secondaryButtonClass} inline-flex items-center gap-2`}>
          <SearchIcon className="h-4 w-4" />
          {def.filters.length > 0 ? "ค้นหา" : "แสดง"}
        </button>
      </form>

      {loadError ? (
        <ErrorState error={loadError} />
      ) : (
        <ReferenceTable
          dataset={tab}
          rows={rows}
          options={selectOptions}
          canManage={canManage}
          showingInactive={activeMode !== "active"}
          showInactiveHref={showInactiveHref}
          footer={
            meta && (
              <Pagination
                meta={meta}
                basePath="/backoffice/reference"
                params={pagerParams}
                itemLabel={DATASET_LABELS[tab]}
              />
            )
          }
        />
      )}
    </>
  );
}
