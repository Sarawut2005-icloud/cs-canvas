import { CATEGORY_LABELS, type CurriculumCategory } from "../../../../lib/public-curricula";

export const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABELS) as CurriculumCategory[]).map(
  (value) => ({ value, label: CATEGORY_LABELS[value] }),
);

/**
 * One shape for a curriculum's structure and study plan, whether it came
 * from the admin editor endpoints (with ids) or from the read endpoints
 * every backoffice role may call (`/structure` + `/study-plan`, no ids).
 * The view renders this shape only; `editable` says which source it is.
 */

export type CourseGroup = {
  /** The group id when editable, else a key made from the name. */
  key: string;
  category: CurriculumCategory;
  parentNameTh: string | null;
  nameTh: string;
  listedCredits: number | null;
  availableCourseCount: number | null;
  sortOrder: number;
};

export type PlanCourse = {
  courseCode: string;
  nameTh: string;
  nameEn: string | null;
  credits: number;
  creditPattern: string | null;
  category: CurriculumCategory;
  groupKey: string | null;
  isRequired: boolean;
  choiceGroup: string | null;
  isCountedInPlan: boolean;
  planNote: string | null;
  recommendedYear: number | null;
  recommendedSemester: number | null;
};

export type PlanSlot = {
  /** The slot id when editable, else a key made from its place in the plan. */
  key: string;
  category: CurriculumCategory;
  recommendedYear: number;
  recommendedSemester: number;
  slotCount: number;
  creditsPerSlot: number;
  label: string;
  groupKey: string | null;
  note: string | null;
};

export type CreditRule = { category: CurriculumCategory; minCredits: number };

export type CurriculumModel = {
  editable: boolean;
  creditRules: CreditRule[];
  groups: CourseGroup[];
  courses: PlanCourse[];
  slots: PlanSlot[];
};

/* ---------- API shapes ---------- */

type Brief = {
  code: string;
  nameTh: string;
  nameEn: string | null;
  credits: number;
  creditPattern: string | null;
};

export type StructureResponse = {
  creditRules: CreditRule[];
  groups: {
    category: CurriculumCategory;
    parentNameTh: string | null;
    nameTh: string;
    listedCredits: number | null;
    availableCourseCount: number | null;
    courses: (Brief & {
      isRequired: boolean;
      recommendedYear: number | null;
      recommendedSemester: number | null;
    })[];
  }[];
  otherCourses: (Brief & {
    category: CurriculumCategory;
    isRequired: boolean;
    choiceGroup: string | null;
    recommendedYear: number | null;
    recommendedSemester: number | null;
  })[];
};

export type StudyPlanResponse = {
  terms: {
    year: number;
    semester: number;
    courses: (Brief & {
      category: CurriculumCategory;
      isRequired: boolean;
      choiceGroup: string | null;
      isCountedInPlan: boolean;
      planNote: string | null;
    })[];
    electiveSlots: {
      label: string;
      category: CurriculumCategory;
      slotCount: number;
      creditsPerSlot: number;
      courseGroup: string | null;
    }[];
  }[];
};

export type EditorGroup = {
  id: string;
  category: CurriculumCategory;
  parentNameTh: string;
  nameTh: string;
  listedCredits: number | null;
  availableCourseCount: number | null;
  sortOrder: number;
  courseCount: number;
};

export type EditorCourse = Omit<PlanCourse, "groupKey"> & { courseGroupId: string | null };

export type EditorSlot = Omit<PlanSlot, "key" | "groupKey"> & {
  id: string;
  courseGroupId: string | null;
};

/* ---------- normalisers ---------- */

export function fromEditor(
  creditRules: CreditRule[],
  groups: EditorGroup[],
  courses: EditorCourse[],
  slots: EditorSlot[],
): CurriculumModel {
  return {
    editable: true,
    creditRules,
    groups: groups.map((g) => ({
      key: g.id,
      category: g.category,
      parentNameTh: g.parentNameTh,
      nameTh: g.nameTh,
      listedCredits: g.listedCredits,
      availableCourseCount: g.availableCourseCount,
      sortOrder: g.sortOrder,
    })),
    courses: courses.map(({ courseGroupId, ...c }) => ({ ...c, groupKey: courseGroupId })),
    slots: slots.map(({ id, courseGroupId, ...s }) => ({ ...s, key: id, groupKey: courseGroupId })),
  };
}

export function fromReadOnly(
  structure: StructureResponse,
  plan: StudyPlanResponse,
): CurriculumModel {
  const groups: CourseGroup[] = structure.groups.map((g, index) => ({
    key: `group:${g.nameTh}`,
    category: g.category,
    parentNameTh: g.parentNameTh,
    nameTh: g.nameTh,
    listedCredits: g.listedCredits,
    availableCourseCount: g.availableCourseCount ?? null,
    sortOrder: index,
  }));
  const keyOfGroup = new Map(groups.map((g) => [g.nameTh, g.key]));

  // Plan-only fields (choice group, counted, note) come from the study plan.
  const planFields = new Map(
    plan.terms.flatMap((t) => t.courses.map((c) => [c.code, c] as const)),
  );
  const toCourse = (
    c: Brief & {
      isRequired: boolean;
      recommendedYear: number | null;
      recommendedSemester: number | null;
      choiceGroup?: string | null;
    },
    category: CurriculumCategory,
    groupKey: string | null,
  ): PlanCourse => {
    const planned = planFields.get(c.code);
    return {
      courseCode: c.code,
      nameTh: c.nameTh,
      nameEn: c.nameEn,
      credits: c.credits,
      creditPattern: c.creditPattern,
      category,
      groupKey,
      isRequired: c.isRequired,
      choiceGroup: planned?.choiceGroup ?? c.choiceGroup ?? null,
      isCountedInPlan: planned?.isCountedInPlan ?? true,
      planNote: planned?.planNote ?? null,
      recommendedYear: c.recommendedYear,
      recommendedSemester: c.recommendedSemester,
    };
  };

  const courses = [
    ...structure.groups.flatMap((g, index) =>
      g.courses.map((c) => toCourse(c, g.category, groups[index].key)),
    ),
    ...structure.otherCourses.map((c) => toCourse(c, c.category, null)),
  ];

  const slots: PlanSlot[] = plan.terms.flatMap((t) =>
    t.electiveSlots.map((s) => ({
      key: `slot:${t.year}-${t.semester}-${s.label}`,
      category: s.category,
      recommendedYear: t.year,
      recommendedSemester: t.semester,
      slotCount: s.slotCount,
      creditsPerSlot: s.creditsPerSlot,
      label: s.label,
      groupKey: s.courseGroup ? (keyOfGroup.get(s.courseGroup) ?? null) : null,
      note: null,
    })),
  );

  return { editable: false, creditRules: structure.creditRules, groups, courses, slots };
}

/* ---------- study plan ---------- */

export type PlanTerm = {
  year: number;
  semester: number;
  courses: PlanCourse[];
  slots: PlanSlot[];
  totalCredits: number;
};

export const SEMESTER_LABEL: Record<number, string> = {
  1: "ภาคเรียนที่ 1",
  2: "ภาคเรียนที่ 2",
  3: "ภาคฤดูร้อน",
};

/**
 * Years 1–4 with both regular semesters always (so an admin can fill an
 * empty one), plus any later year or summer term that has something in it.
 */
export function planTerms(model: CurriculumModel): PlanTerm[] {
  const keys = new Set<string>();
  for (let year = 1; year <= 4; year++) for (const sem of [1, 2]) keys.add(`${year}-${sem}`);
  for (const c of model.courses)
    if (c.recommendedYear && c.recommendedSemester)
      keys.add(`${c.recommendedYear}-${c.recommendedSemester}`);
  for (const s of model.slots) keys.add(`${s.recommendedYear}-${s.recommendedSemester}`);

  return [...keys]
    .map((key) => key.split("-").map(Number) as [number, number])
    .sort(([y1, s1], [y2, s2]) => y1 - y2 || s1 - s2)
    .map(([year, semester]) => {
      const courses = model.courses
        .filter((c) => c.recommendedYear === year && c.recommendedSemester === semester)
        .sort((a, b) => a.courseCode.localeCompare(b.courseCode));
      const slots = model.slots
        .filter((s) => s.recommendedYear === year && s.recommendedSemester === semester)
        .sort((a, b) => a.label.localeCompare(b.label, "th"));
      const totalCredits =
        courses.reduce((sum, c) => sum + (c.isCountedInPlan ? c.credits : 0), 0) +
        slots.reduce((sum, s) => sum + s.slotCount * s.creditsPerSlot, 0);
      return { year, semester, courses, slots, totalCredits };
    });
}
