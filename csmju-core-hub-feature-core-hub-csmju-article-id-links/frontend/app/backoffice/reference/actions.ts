"use server";

import { revalidatePath } from "next/cache";
import {
  apiFetch,
  ApiError,
  type ReferenceDataset,
  type ReferenceItem,
} from "../../lib/api";
import { describeError, type ActionResult } from "../../lib/subsystems";

/**
 * Server actions for the reference page. Every dataset shares one contract:
 * POST creates, PATCH /:code edits (never `code`), and `isActive` replaces
 * delete. The API checks `reference:manage` on every call.
 */

export type ReferenceBody = Record<string, string | number | boolean>;

const THAI = /[฀-๿]/;

/** The reference module answers in Thai already — keep its wording. */
function describe(err: ApiError): string {
  if (err.code === "VALIDATION_ERROR" && err.details.length > 0) {
    return err.details.join(" · ");
  }
  if (THAI.test(err.message)) return err.message;
  return describeError(err);
}

async function run<T>(call: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await call();
    revalidatePath("/backoffice/reference");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: describe(err) };
    return { ok: false, error: "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง" };
  }
}

const itemPath = (dataset: ReferenceDataset, code: string) =>
  `/${dataset}/${encodeURIComponent(code)}`;

export async function createReference(
  dataset: ReferenceDataset,
  body: ReferenceBody,
) {
  return run(() =>
    apiFetch<ReferenceItem>(`/${dataset}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

export async function updateReference(
  dataset: ReferenceDataset,
  code: string,
  body: ReferenceBody,
) {
  return run(() =>
    apiFetch<ReferenceItem>(itemPath(dataset, code), {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
}

/** POST /academic-terms/:code/set-current — the API clears the previous one. */
export async function setCurrentTerm(code: string) {
  return run(() =>
    apiFetch<ReferenceItem>(`${itemPath("academic-terms", code)}/set-current`, {
      method: "POST",
    }),
  );
}
