import type { Metadata } from "next";
import Link from "next/link";
import { ArrowBackIcon, OpenInNewIcon } from "../../../../components/icons";
import { apiFetch, getCurrentUser } from "../../../../lib/api";
import type { CurriculumCategory } from "../../../../lib/public-curricula";
import { ErrorState } from "../../../subsystems/_components/StateViews";
import CurriculumView from "./CurriculumView";
import {
  fromEditor,
  fromReadOnly,
  type CreditRule,
  type CurriculumModel,
  type EditorCourse,
  type EditorGroup,
  type EditorSlot,
  type StructureResponse,
  type StudyPlanResponse,
} from "./model";

export const metadata: Metadata = {
  title: "หลักสูตร · ข้อมูลอ้างอิง · BackOffice · CSMJU",
};

type CurriculumDetail = {
  code: string;
  nameTh: string;
  nameEn: string | null;
  curriculumYear: number;
  totalCredits: number | null;
  departmentCode: string;
  isActive: boolean;
  degreeFullTh: string | null;
  degreeShortTh: string | null;
  studyDurationYears: number | null;
  creditRules: { category: CurriculumCategory; minCredits: number }[];
};

/**
 * One curriculum in the backoffice: its structure (groups, credits, courses)
 * and study plan, years 1–4 by semester (handoff 2.6). Admins (the page
 * asks the editor endpoints, which need `reference:manage`) get edit mode;
 * everyone else reads the same endpoints subsystems use.
 */
export default async function CurriculumDetailPage({
  params,
}: PageProps<"/backoffice/reference/curricula/[code]">) {
  const { code } = await params;
  const base = `/curricula/${encodeURIComponent(code)}`;
  const user = await getCurrentUser();
  const canEdit = user?.role === "admin";

  let detail: CurriculumDetail | null = null;
  let model: CurriculumModel | null = null;
  let error: unknown = null;

  try {
    detail = await apiFetch<CurriculumDetail>(base);
    if (canEdit) {
      const [groups, courses, slots] = await Promise.all([
        apiFetch<EditorGroup[]>(`${base}/course-groups`),
        apiFetch<EditorCourse[]>(`${base}/courses`),
        apiFetch<EditorSlot[]>(`${base}/plan-slots`),
      ]);
      model = fromEditor(detail.creditRules as CreditRule[], groups, courses, slots);
    } else {
      const [structure, plan] = await Promise.all([
        apiFetch<StructureResponse>(`${base}/structure`),
        apiFetch<StudyPlanResponse>(`${base}/study-plan`),
      ]);
      model = fromReadOnly(structure, plan);
    }
  } catch (err) {
    error = err;
  }

  const back = (
    <Link
      href="/backoffice/reference?tab=curricula"
      className="fade-slide-up inline-flex w-fit items-center gap-1 text-label-md text-primary-container hover:underline"
    >
      <ArrowBackIcon className="h-4 w-4" />
      หลักสูตรทั้งหมด
    </Link>
  );

  if (error || !detail || !model) {
    return (
      <>
        {back}
        <ErrorState error={error} />
      </>
    );
  }

  return (
    <>
      {back}

      <header className="fade-slide-up flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-label-sm text-primary-container">
            รหัส <span className="tabular-nums">{detail.code}</span> · หลักสูตรปี พ.ศ.{" "}
            {detail.curriculumYear}
            {!detail.isActive && " · ปิดใช้งาน"}
          </p>
          <h2 className="mt-1 font-display text-headline-lg text-on-surface">{detail.nameTh}</h2>
          {detail.nameEn && <p className="text-body-md text-on-surface-variant">{detail.nameEn}</p>}
          <p className="mt-2 text-body-md text-on-surface-variant">
            {[
              detail.degreeFullTh ?? detail.degreeShortTh,
              detail.totalCredits ? `${detail.totalCredits} หน่วยกิต` : null,
              detail.studyDurationYears ? `${detail.studyDurationYears} ปี` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {detail.isActive && (
          <Link
            href={`/curricula/${encodeURIComponent(detail.code)}`}
            target="_blank"
            className="inline-flex shrink-0 items-center gap-1 text-label-md text-primary-container hover:underline"
          >
            ดูหน้าสาธารณะ
            <OpenInNewIcon className="h-4 w-4" />
          </Link>
        )}
      </header>

      <CurriculumView code={detail.code} model={model} />
    </>
  );
}
