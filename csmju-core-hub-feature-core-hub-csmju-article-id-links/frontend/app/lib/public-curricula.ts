import { BACKEND_URL } from "./backend";

/**
 * Curricula for the public website — `GET /api/v1/public/curricula…`,
 * readable without signing in. Server-only: called without a token, so
 * what a signed-in visitor sees is the same as anyone else.
 */

export type CurriculumCategory =
  | "GENERAL_EDUCATION"
  | "CORE"
  | "MAJOR_REQUIRED"
  | "MAJOR_ELECTIVE"
  | "FREE_ELECTIVE"
  | "OTHER";

export const CATEGORY_LABELS: Record<CurriculumCategory, string> = {
  GENERAL_EDUCATION: "หมวดวิชาศึกษาทั่วไป",
  CORE: "วิชาแกน",
  MAJOR_REQUIRED: "วิชาเอกบังคับ",
  MAJOR_ELECTIVE: "วิชาเอกเลือก",
  FREE_ELECTIVE: "หมวดวิชาเลือกเสรี",
  OTHER: "อื่นๆ",
};

export type CurriculumSummary = {
  code: string;
  nameTh: string;
  nameEn: string | null;
  curriculumYear: number;
  totalCredits: number | null;
  departmentCode: string;
};

export type CurriculumDetail = CurriculumSummary & {
  degreeFullTh: string | null;
  degreeShortTh: string | null;
  studyDurationYears: number | null;
  philosophyTh: string | null;
  creditRules: { category: CurriculumCategory; minCredits: number }[];
};

export type CourseBrief = {
  code: string;
  nameTh: string;
  nameEn: string | null;
  credits: number;
  creditPattern: string | null;
};

export type CurriculumStructure = {
  creditRules: { category: CurriculumCategory; minCredits: number }[];
  groups: {
    category: CurriculumCategory;
    parentNameTh: string | null;
    nameTh: string;
    listedCredits: number | null;
    courses: (CourseBrief & { isRequired: boolean })[];
  }[];
  otherCourses: (CourseBrief & { category: CurriculumCategory })[];
};

export type StudyPlan = {
  totalCredits: number;
  terms: {
    year: number;
    semester: number;
    totalCredits: number;
    courses: (CourseBrief & { category: CurriculumCategory })[];
    electiveSlots: {
      label: string;
      category: CurriculumCategory;
      slotCount: number;
      creditsPerSlot: number;
    }[];
  }[];
};

/** Result of a public call: the data, `null` for 404, or a failure. */
type Fetched<T> = { ok: true; data: T | null } | { ok: false };

/** Revalidated like the other public pages; the API sends max-age=300. */
const REVALIDATE_SECONDS = 300;

async function getPublic<T>(path: string): Promise<Fetched<T>> {
  try {
    const res = await fetch(`${BACKEND_URL}/public/curricula${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404 || res.status === 400) return { ok: true, data: null };
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { success?: boolean; data?: T };
    return body.success ? { ok: true, data: body.data ?? null } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export function listPublicCurricula() {
  return getPublic<CurriculumSummary[]>("?limit=100");
}

export function getPublicCurriculum(code: string) {
  const c = encodeURIComponent(code);
  return Promise.all([
    getPublic<CurriculumDetail>(`/${c}`),
    getPublic<CurriculumStructure>(`/${c}/structure`),
    getPublic<StudyPlan>(`/${c}/study-plan`),
  ]);
}
