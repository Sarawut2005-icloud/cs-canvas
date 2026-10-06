import type { Metadata } from "next";
import { AccountCircleIcon } from "../../components/icons";
import { getAdvisees, getMyPerson, type Person, type PersonStatus } from "../../lib/api";
import { PERSON_STATUS_BADGE, PERSON_STATUSES } from "../../lib/people";
import AutoSubmitSelect from "../_components/AutoSubmitSelect";
import PageHeader from "../_components/PageHeader";
import { cardClass, inputClass } from "../_components/ui";
import { EmptyState, ErrorState } from "../subsystems/_components/StateViews";
import StudentsTable from "../students/StudentsTable";

export const metadata: Metadata = {
  title: "นักศึกษาในที่ปรึกษา · BackOffice · CSMJU",
};

function parseStatus(value: string | string[] | undefined): PersonStatus | "ALL" {
  const upper = (Array.isArray(value) ? value[0] : value)?.toUpperCase() ?? "";
  if (upper === "ALL") return "ALL";
  return (PERSON_STATUSES as string[]).includes(upper) ? (upper as PersonStatus) : "ACTIVE";
}

/** Newest intake first; students without an entry year go last. */
function byEntryYear(students: Person[]): [number | null, Person[]][] {
  const groups = new Map<number | null, Person[]>();
  for (const student of students) {
    const list = groups.get(student.entryYear) ?? [];
    list.push(student);
    groups.set(student.entryYear, list);
  }
  return [...groups.entries()].sort(([a], [b]) => (b ?? -1) - (a ?? -1));
}

/**
 * The signed-in lecturer's advisees (handoff 2.10): their own person code
 * from GET /people/me, then GET /people/:code/advisees — grouped by intake.
 */
export default async function AdviseesPage({ searchParams }: PageProps<"/backoffice/advisees">) {
  const status = parseStatus((await searchParams).status);
  const me = await getMyPerson();

  const header = (
    <PageHeader
      title="นักศึกษาในที่ปรึกษา"
      description="นักศึกษาที่คุณเป็นอาจารย์ที่ปรึกษา แยกตามปีที่เข้าศึกษา — คลิกแถวเพื่อดูรายละเอียด"
    />
  );

  if (!me || me.personType !== "STAFF") {
    return (
      <>
        {header}
        <div className="fade-slide-up stagger-1 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest">
          <EmptyState
            Icon={AccountCircleIcon}
            title="บัญชีนี้ยังไม่ผูกกับทะเบียนบุคลากร"
            description="รายชื่อนักศึกษาในที่ปรึกษาอ่านจากทะเบียนบุคลากรของคุณ กรุณาติดต่อผู้ดูแลระบบให้ผูกบัญชีกับรหัสบุคลากร"
          />
        </div>
      </>
    );
  }

  let advisees: Person[] = [];
  let error: unknown = null;
  try {
    advisees = await getAdvisees(me.personCode, status);
  } catch (err) {
    error = err;
  }

  const groups = byEntryYear(advisees);

  return (
    <>
      {header}

      <form method="get" className="fade-slide-up stagger-1 flex flex-wrap items-end gap-3">
        <div className="min-w-48 space-y-1.5">
          <label htmlFor="advisee-status" className="block text-label-md text-on-surface">
            สถานะ
          </label>
          <AutoSubmitSelect
            id="advisee-status"
            name="status"
            defaultValue={status}
            className={inputClass}
          >
            <option value="ALL">ทุกสถานะ</option>
            {PERSON_STATUSES.map((value) => (
              <option key={value} value={value}>
                {PERSON_STATUS_BADGE[value].label}
              </option>
            ))}
          </AutoSubmitSelect>
        </div>
        <p className="pb-3 text-label-md text-on-surface-variant">ทั้งหมด {advisees.length} คน</p>
      </form>

      {error ? (
        <ErrorState error={error} />
      ) : groups.length === 0 ? (
        <div className="fade-slide-up stagger-2 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest">
          <EmptyState
            Icon={AccountCircleIcon}
            title={status === "ALL" ? "ยังไม่มีนักศึกษาในที่ปรึกษา" : "ไม่พบนักศึกษาในสถานะนี้"}
            description={
              status === "ALL"
                ? "เมื่อผู้ดูแลระบบกำหนดให้คุณเป็นอาจารย์ที่ปรึกษา รายชื่อจะแสดงที่นี่"
                : "ลองเลือก “ทุกสถานะ” เพื่อดูนักศึกษาที่สำเร็จการศึกษาหรือพ้นสภาพแล้ว"
            }
          />
        </div>
      ) : (
        groups.map(([year, students]) => (
          <section key={year ?? "none"} className={`fade-slide-up stagger-2 ${cardClass}`}>
            <h3 className="flex items-baseline justify-between gap-3 border-b border-outline-variant/40 px-6 py-4 font-display text-headline-md text-on-surface">
              {year ? `ปีที่เข้า ${year}` : "ไม่ระบุปีที่เข้า"}
              <span className="text-label-md text-on-surface-variant">{students.length} คน</span>
            </h3>
            <StudentsTable students={students} canManage={false} />
          </section>
        ))
      )}
    </>
  );
}
