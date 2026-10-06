import type { ImportResult } from "../../lib/api";

/** A failed import call — `details` lists the API's row errors when it has them. */
export type ApiFailure = {
  message: string;
  details?: string[];
};

/**
 * POST /api/people/import from the browser. The CSV popup and the add-person
 * forms both go through here, so every new person passes the same checks and
 * gets the same automatic account as a file import (handoff 2.3).
 */
export async function callImport(
  mode: "dry-run" | "commit",
  csv: string,
): Promise<{ ok: true; data: ImportResult } | { ok: false; error: ApiFailure }> {
  let res: Response;
  try {
    res = await fetch("/api/people/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, csv }),
    });
  } catch {
    return {
      ok: false,
      error: { message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง" },
    };
  }
  const body = (await res.json().catch(() => null)) as
    | { success: true; data: ImportResult }
    | { success: false; error?: { message?: string; details?: string[] } }
    | null;
  if (!res.ok || !body?.success) {
    const error = body && !body.success ? body.error : undefined;
    return {
      ok: false,
      error: {
        message:
          res.status === 403
            ? "บัญชีของคุณไม่มีสิทธิ์นำเข้าข้อมูล (people:manage)"
            : (error?.message ?? `นำเข้าไม่สำเร็จ (${res.status})`),
        details: error?.details,
      },
    };
  }
  return { ok: true, data: body.data };
}

/** Header row of the import file — the forms build their CSV with the same names. */
export const IMPORT_HEADERS = [
  "person_code",
  "person_type",
  "staff_type",
  "full_name_th",
  "full_name_en",
  "academic_title",
  "university_email",
  "entry_year",
  "faculty_code",
  "department_code",
  "curriculum_code",
  "status",
] as const;

export type ImportColumn = (typeof IMPORT_HEADERS)[number];

/** One CSV cell: quoted when it holds a comma, quote or line break. */
function cell(value: string): string {
  const text = value.trim();
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV text for the rows, header first — data line N is file line N + 1. */
export function toImportCsv(rows: Partial<Record<ImportColumn, string>>[]): string {
  return [
    IMPORT_HEADERS.join(","),
    ...rows.map((row) => IMPORT_HEADERS.map((h) => cell(row[h] ?? "")).join(",")),
  ].join("\n");
}
