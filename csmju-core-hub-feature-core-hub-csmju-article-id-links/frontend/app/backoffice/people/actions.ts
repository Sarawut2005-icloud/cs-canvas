"use server";

import { revalidatePath } from "next/cache";
import {
  ApiError,
  apiFetch,
  getAdvisors,
  getPerson,
  type Person,
  type PersonPatch,
} from "../../lib/api";
import { describeError, type ActionResult } from "../../lib/subsystems";

/**
 * Server actions for the people pages. The Core API decides whether the
 * caller may (people:manage is admin-only); we only translate the answer.
 */

/** Backend messages from PATCH /people/:code that deserve a specific line. */
const PEOPLE_MESSAGES: [RegExp, string][] = [
  [/ไม่พบบัญชีผู้ใช้/, "ไม่พบบัญชี Core Hub ที่ใช้อีเมลนี้ กรุณาตรวจสอบอีเมลที่ใช้เข้าสู่ระบบ"],
  [/ผูก.*แล้ว|already linked/i, "บัญชีนี้ถูกผูกกับบุคคลอื่นไว้แล้ว"],
  [/universityEmail must be an email|ต้องเป็นอีเมล/, "รูปแบบอีเมลไม่ถูกต้อง"],
  [/ไม่พบบุคคล/, "ไม่พบบุคคลรหัสนี้ในทะเบียน"],
];

function explain(err: unknown): string {
  if (!(err instanceof ApiError)) return "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง";
  const known = PEOPLE_MESSAGES.find(([pattern]) => pattern.test(err.message));
  if (known) return known[1];
  if (err.code === "CONFLICT") return "อีเมลหรือบัญชีนี้ถูกใช้กับบุคคลอื่นแล้ว";
  return describeError(err);
}

async function run<T>(call: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await call();
    revalidatePath("/backoffice/students");
    revalidatePath("/backoffice/faculty");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: explain(err) };
  }
}

/** PATCH /people/:code — status, university email or Core Hub account link. */
export async function updatePerson(personCode: string, patch: PersonPatch) {
  return run(() =>
    apiFetch<Person>(`/people/${encodeURIComponent(personCode)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  );
}

/** Active advisors of a student — read on demand when the panel opens. */
export async function loadAdvisors(
  personCode: string,
): Promise<ActionResult<Person[]>> {
  try {
    return { ok: true, data: await getAdvisors(personCode) };
  } catch (err) {
    return { ok: false, error: explain(err) };
  }
}

/**
 * Which of these codes the registry already has. The add forms reuse the
 * import, which would silently update an existing person — asking first
 * keeps "เพิ่ม" from overwriting someone (GET /people/:code, people:read).
 */
export async function findExistingCodes(
  codes: string[],
): Promise<ActionResult<string[]>> {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))].slice(0, 200);
  try {
    const found = await Promise.all(
      unique.map(async (code) => {
        try {
          await getPerson(code);
          return code;
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }
      }),
    );
    return { ok: true, data: found.filter((c): c is string => c !== null) };
  } catch (err) {
    return { ok: false, error: explain(err) };
  }
}
