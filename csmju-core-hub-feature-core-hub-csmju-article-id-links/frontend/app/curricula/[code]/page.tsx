import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowBackIcon } from "../../components/icons";
import RetryButton from "../../components/RetryButton";
import {
  CATEGORY_LABELS,
  getPublicCurriculum,
  type CourseBrief,
  type StudyPlan,
} from "../../lib/public-curricula";
import { SiteFooter, SiteHeader } from "../../welcome/SiteChrome";

export const metadata: Metadata = {
  title: "หลักสูตร · CSMJU",
};

const SEMESTER_LABEL: Record<number, string> = {
  1: "ภาคเรียนที่ 1",
  2: "ภาคเรียนที่ 2",
  3: "ภาคฤดูร้อน",
};

function CourseRow({ course }: { course: CourseBrief }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block text-caption tabular-nums text-on-surface-variant">{course.code}</span>
        <span className="block text-body-md text-on-surface">{course.nameTh}</span>
      </span>
      <span className="shrink-0 text-label-sm tabular-nums text-on-surface-variant">
        {course.creditPattern ?? `${course.credits} หน่วยกิต`}
      </span>
    </li>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-l-4 border-primary-container pl-3 font-display text-headline-md text-on-surface">
      {children}
    </h2>
  );
}

/** Study plan years 1–4, a card per year with its semesters. */
function StudyPlanYears({ plan }: { plan: StudyPlan }) {
  const years = [...new Set(plan.terms.map((t) => t.year))].sort((a, b) => a - b);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {years.map((year) => (
        <article
          key={year}
          className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm"
        >
          <h3 className="mb-3 font-display text-label-md font-bold text-on-surface">ชั้นปีที่ {year}</h3>
          <div className="space-y-4">
            {plan.terms
              .filter((t) => t.year === year)
              .map((term) => (
                <section key={term.semester}>
                  <p className="mb-1 flex justify-between text-label-sm text-primary-container">
                    <span>{SEMESTER_LABEL[term.semester] ?? `ภาคเรียนที่ ${term.semester}`}</span>
                    <span className="tabular-nums">{term.totalCredits} หน่วยกิต</span>
                  </p>
                  <ul className="divide-y divide-outline-variant/30">
                    {term.courses.map((course) => (
                      <CourseRow key={course.code} course={course} />
                    ))}
                    {term.electiveSlots.map((slot) => (
                      <li key={slot.label} className="flex justify-between gap-3 py-2 text-body-md">
                        <span className="text-on-surface-variant">
                          {slot.label}
                          {slot.slotCount > 1 ? ` × ${slot.slotCount}` : ""}
                        </span>
                        <span className="shrink-0 text-label-sm tabular-nums text-on-surface-variant">
                          {slot.creditsPerSlot * slot.slotCount} หน่วยกิต
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * One curriculum for the public website: overview, structure and the
 * study plan. Inactive or unknown curricula answer 404 from the API.
 */
export default async function CurriculumPage({ params }: PageProps<"/curricula/[code]">) {
  const { code } = await params;
  const [detail, structure, plan] = await getPublicCurriculum(code);

  if (detail.ok && detail.data === null) notFound();

  const back = (
    <Link
      href="/curricula"
      className="inline-flex w-fit items-center gap-1 text-label-md text-primary-container hover:underline"
    >
      <ArrowBackIcon className="h-4 w-4" />
      หลักสูตรทั้งหมด
    </Link>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        {back}

        {!detail.ok || !detail.data ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 text-center">
            <p className="text-body-md text-on-surface-variant">
              เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง
            </p>
            <RetryButton />
          </div>
        ) : (
          <>
            <header>
              <p className="text-label-sm text-primary-container">
                หลักสูตรปี พ.ศ. {detail.data.curriculumYear}
              </p>
              <h1 className="mt-1 font-display text-headline-md text-on-surface md:text-headline-lg">
                {detail.data.nameTh}
              </h1>
              {detail.data.nameEn && (
                <p className="mt-1 text-body-md text-on-surface-variant">{detail.data.nameEn}</p>
              )}
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  ["ชื่อปริญญา", detail.data.degreeFullTh ?? detail.data.degreeShortTh],
                  [
                    "หน่วยกิตตลอดหลักสูตร",
                    detail.data.totalCredits ? `${detail.data.totalCredits} หน่วยกิต` : null,
                  ],
                  [
                    "ระยะเวลาศึกษา",
                    detail.data.studyDurationYears ? `${detail.data.studyDurationYears} ปี` : null,
                  ],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4"
                    >
                      <dt className="text-label-sm text-on-surface-variant">{label}</dt>
                      <dd className="mt-1 text-body-md text-on-surface">{value}</dd>
                    </div>
                  ))}
              </dl>
            </header>

            <section className="space-y-4">
              <SectionTitle>โครงสร้างหลักสูตร</SectionTitle>
              {!structure.ok || !structure.data ? (
                <p className="text-body-md text-on-surface-variant">ยังโหลดโครงสร้างหลักสูตรไม่ได้</p>
              ) : (
                <>
                  {structure.data.creditRules.length > 0 && (
                    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {structure.data.creditRules.map((rule) => (
                        <li
                          key={rule.category}
                          className="flex justify-between gap-3 rounded-lg bg-surface-container-low px-4 py-3 text-body-md"
                        >
                          <span className="text-on-surface">{CATEGORY_LABELS[rule.category]}</span>
                          <span className="shrink-0 tabular-nums text-on-surface-variant">
                            ไม่น้อยกว่า {rule.minCredits} หน่วยกิต
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="space-y-2">
                    {structure.data.groups.map((group) => (
                      <details
                        key={`${group.parentNameTh ?? ""}/${group.nameTh}`}
                        className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-5 py-3"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1">
                          <span className="min-w-0">
                            <span className="block text-caption text-on-surface-variant">
                              {group.parentNameTh ?? CATEGORY_LABELS[group.category]}
                            </span>
                            <span className="block text-label-md text-on-surface">{group.nameTh}</span>
                          </span>
                          <span className="shrink-0 text-label-sm text-on-surface-variant">
                            {group.listedCredits ? `${group.listedCredits} หน่วยกิต · ` : ""}
                            {group.courses.length} วิชา
                          </span>
                        </summary>
                        <ul className="mt-2 divide-y divide-outline-variant/30 border-t border-outline-variant/30">
                          {group.courses.map((course) => (
                            <CourseRow key={course.code} course={course} />
                          ))}
                        </ul>
                      </details>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="space-y-4">
              <SectionTitle>แผนการศึกษา</SectionTitle>
              {!plan.ok || !plan.data ? (
                <p className="text-body-md text-on-surface-variant">ยังโหลดแผนการศึกษาไม่ได้</p>
              ) : plan.data.terms.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">หลักสูตรนี้ยังไม่มีแผนการศึกษา</p>
              ) : (
                <StudyPlanYears plan={plan.data} />
              )}
            </section>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
