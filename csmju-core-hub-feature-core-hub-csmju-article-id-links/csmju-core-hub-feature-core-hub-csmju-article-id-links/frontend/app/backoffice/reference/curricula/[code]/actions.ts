"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch, listReference, type Course } from "../../../../lib/api";
import type { CurriculumCategory } from "../../../../lib/public-curricula";
import { describeError, type ActionResult } from "../../../../lib/subsystems";

/**
 * Writes to a curriculum's structure and study plan (handoff 2.6). The Core
 * API checks `reference:manage` on every call and answers in Thai already;
 * after a write both this page and the public curriculum page refresh.
 */

const THAI = /[฀-๿]/;

function describe(err: unknown): string {
  if (!(err instanceof ApiError)) return "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง";
  if (err.code === "VALIDATION_ERROR" && err.details.length > 0) return err.details.join(" · ");
  if (THAI.test(err.message)) return err.message;
  return describeError(err);
}

async function write<T>(code: string, path: string, init: RequestInit): Promise<ActionResult<T>> {
  try {
    const data = await apiFetch<T>(`/curricula/${encodeURIComponent(code)}${path}`, init);
    revalidatePath(`/backoffice/reference/curricula/${code}`);
    revalidatePath(`/curricula/${code}`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: describe(err) };
  }
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export type GroupBody = {
  category: CurriculumCategory;
  parentNameTh: string;
  nameTh: string;
  listedCredits: number | null;
  availableCourseCount: number | null;
  sortOrder: number;
};

export async function saveGroup(code: string, groupId: string | null, body: GroupBody) {
  return groupId
    ? write(code, `/course-groups/${encodeURIComponent(groupId)}`, json("PATCH", body))
    : write(code, "/course-groups", json("POST", body));
}

export async function deleteGroup(code: string, groupId: string) {
  return write(code, `/course-groups/${encodeURIComponent(groupId)}`, json("DELETE"));
}

export type CourseBody = {
  category: CurriculumCategory;
  courseGroupId: string | null;
  isRequired: boolean;
  choiceGroup: string | null;
  isCountedInPlan: boolean;
  planNote: string | null;
  recommendedYear: number | null;
  recommendedSemester: number | null;
};

/** `existing` = the course is already in this curriculum → PATCH, else POST. */
export async function saveCourse(
  code: string,
  courseCode: string,
  existing: boolean,
  body: Partial<CourseBody>,
) {
  return existing
    ? write(code, `/courses/${encodeURIComponent(courseCode)}`, json("PATCH", body))
    : write(code, "/courses", json("POST", { courseCode, ...body }));
}

export async function removeCourse(code: string, courseCode: string) {
  return write(code, `/courses/${encodeURIComponent(courseCode)}`, json("DELETE"));
}

export async function saveCreditRule(code: string, category: CurriculumCategory, minCredits: number) {
  return write(code, `/credit-rules/${category}`, json("PUT", { minCredits }));
}

export async function deleteCreditRule(code: string, category: CurriculumCategory) {
  return write(code, `/credit-rules/${category}`, json("DELETE"));
}

export type SlotBody = {
  category: CurriculumCategory;
  recommendedYear: number;
  recommendedSemester: number;
  slotCount: number;
  creditsPerSlot: number;
  label: string;
  courseGroupId: string | null;
  note: string | null;
};

export async function saveSlot(code: string, slotId: string | null, body: SlotBody) {
  return slotId
    ? write(code, `/plan-slots/${encodeURIComponent(slotId)}`, json("PATCH", body))
    : write(code, "/plan-slots", json("POST", body));
}

export async function deleteSlot(code: string, slotId: string) {
  return write(code, `/plan-slots/${encodeURIComponent(slotId)}`, json("DELETE"));
}

export type CourseOption = { code: string; nameTh: string; credits: number };

/** Active courses matching `q` (code or name) for the add-course picker. */
export async function searchCourses(q: string): Promise<ActionResult<CourseOption[]>> {
  const query = q.trim();
  if (query.length < 2) return { ok: true, data: [] };
  try {
    const { data } = await listReference<Course>("courses", { q: query, limit: 20 });
    return { ok: true, data: data.map(({ code, nameTh, credits }) => ({ code, nameTh, credits })) };
  } catch (err) {
    return { ok: false, error: describe(err) };
  }
}
