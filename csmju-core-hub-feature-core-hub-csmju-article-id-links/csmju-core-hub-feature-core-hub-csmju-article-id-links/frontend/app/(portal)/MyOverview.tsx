import { PersonIcon } from "../components/icons";
import type { AcademicTerm, MyPerson } from "../lib/api";

const STATUS_LABELS: Record<MyPerson["status"], string> = {
  ACTIVE: "กำลังศึกษา",
  INACTIVE: "ไม่ได้ใช้งาน",
  GRADUATED: "สำเร็จการศึกษา",
};

/**
 * The year of study in the current academic year: year 1 is the entry year.
 * Null when it cannot be worked out or no longer applies (graduated).
 */
export function classYear(
  person: Pick<MyPerson, "entryYear" | "status">,
  term: Pick<AcademicTerm, "academicYear"> | null,
): number | null {
  if (person.status !== "ACTIVE" || !person.entryYear || !term) return null;
  const year = term.academicYear - person.entryYear + 1;
  return year >= 1 ? year : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-container-low px-4 py-3">
      <dt className="text-label-sm text-on-surface-variant">{label}</dt>
      <dd className="mt-1 text-body-md text-on-surface">{children}</dd>
    </div>
  );
}

/**
 * A student's or alumnus's own record (PM 2026-10-05, handoff 2.1) — the
 * same fields an admin sees in PersonPanel, from GET /people/me only.
 * Advisors are shown by name only; their e-mail waits on the PDPA decision.
 */
export default function MyOverview({
  person,
  term,
}: {
  person: MyPerson | null;
  term: AcademicTerm | null;
}) {
  if (!person) {
    return (
      <section className="fade-slide-up stagger-1 flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-outline">
          <PersonIcon className="h-6 w-6" />
        </span>
        <p className="font-display text-label-md font-bold text-on-surface">
          ยังไม่พบข้อมูลนักศึกษาของบัญชีนี้
        </p>
        <p className="max-w-md text-body-md text-on-surface-variant">
          หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อเจ้าหน้าที่สาขาวิชา
        </p>
      </section>
    );
  }

  const year = classYear(person, term);

  return (
    <section className="fade-slide-up stagger-1 rounded-xl border border-surface-variant bg-surface-container-lowest p-6 shadow-sm">
      <h3 className="mb-1 font-display text-headline-md text-on-surface">{person.fullNameTh}</h3>
      {person.fullNameEn && (
        <p className="mb-4 text-body-md text-on-surface-variant">{person.fullNameEn}</p>
      )}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="รหัสนักศึกษา">
          <span className="tabular-nums">{person.personCode}</span>
        </Field>
        <Field label="สถานะ">{STATUS_LABELS[person.status]}</Field>
        <Field label="ปีที่เข้าศึกษา">
          {person.entryYear ? `พ.ศ. ${person.entryYear}` : "—"}
          {year !== null && <span className="text-on-surface-variant"> · ชั้นปีที่ {year}</span>}
        </Field>
        <Field label="หลักสูตร">
          {person.curriculum
            ? `${person.curriculum.nameTh} (พ.ศ. ${person.curriculum.curriculumYear})`
            : "—"}
        </Field>
        <Field label="สาขาวิชา">{person.department?.nameTh ?? person.faculty.nameTh}</Field>
        <Field label="อาจารย์ที่ปรึกษา">
          {person.advisors.length > 0
            ? person.advisors.map((a) => a.fullNameTh).join(", ")
            : "ยังไม่มีอาจารย์ที่ปรึกษา"}
        </Field>
      </dl>
    </section>
  );
}
