"use client";

import { useState } from "react";
import type { ImportResult } from "../../lib/api";
import { findExistingCodes } from "./actions";
import {
  callImport,
  toImportCsv,
  type ApiFailure,
  type ImportColumn,
} from "./import-client";

export type ImportRow = Partial<Record<ImportColumn, string>>;
type DryRun = Extract<ImportResult, { mode: "dry-run" }>;
type Commit = Extract<ImportResult, { mode: "commit" }>;

export type AddPhase =
  | { phase: "editing" }
  | { phase: "checking" }
  | { phase: "checked"; preview: DryRun }
  | { phase: "committing"; preview: DryRun }
  | { phase: "done"; outcome: Commit };

/** Column names in the API's row messages → the labels the form shows. */
const FIELD_LABELS: [RegExp, string][] = [
  [/person_code/g, "รหัส"],
  [/person_type/g, "ประเภทบุคคล"],
  [/staff_type/g, "ประเภทบุคลากร"],
  [/full_name_th/g, "ชื่อ-สกุล (ไทย)"],
  [/full_name_en/g, "ชื่อ-สกุล (อังกฤษ)"],
  [/academic_title/g, "ตำแหน่งทางวิชาการ"],
  [/university_email/g, "อีเมลมหาวิทยาลัย"],
  [/entry_year/g, "ปีที่เข้า"],
  [/faculty_code/g, "คณะ"],
  [/department_code/g, "สาขา"],
  [/curriculum_code/g, "หลักสูตร"],
];

/**
 * The import numbers rows by file line (header = line 1); the form numbers
 * them from 1. Rewrites "ซ้ำกับแถว 3" to the form's "แถวที่ 2" and column
 * names to field labels.
 */
export function formMessage(message: string): string {
  let text = message.replace(/แถว (\d+)/g, (_, line: string) => `แถวที่ ${Number(line) - 1}`);
  for (const [pattern, label] of FIELD_LABELS) text = text.replace(pattern, label);
  return text;
}

/**
 * Check-then-save for the add-person forms (handoff 2.3): the rows become a
 * CSV with the import's own header and go through POST /people/import —
 * dry-run first, row errors shown under each row, commit only when clean.
 * Codes already in the registry are refused here: the import would update
 * that person instead of adding one.
 */
export function useAddPeople() {
  const [state, setState] = useState<AddPhase>({ phase: "editing" });
  const [rowIssues, setRowIssues] = useState<Record<number, string>>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  /** Any edit after a clean check means the preview no longer holds. */
  const touched = () => {
    if (state.phase === "checked") setState({ phase: "editing" });
  };

  const check = async (rows: ImportRow[]) => {
    setState({ phase: "checking" });
    setFailure(null);
    setRowIssues({});

    const [existing, dryRun] = await Promise.all([
      findExistingCodes(rows.map((row) => row.person_code ?? "")),
      callImport("dry-run", toImportCsv(rows)),
    ]);
    if (!dryRun.ok || dryRun.data.mode !== "dry-run") {
      setFailure(dryRun.ok ? { message: "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง" } : dryRun.error);
      return setState({ phase: "editing" });
    }
    if (!existing.ok) {
      setFailure({ message: existing.error });
      return setState({ phase: "editing" });
    }

    const issues: Record<number, string[]> = {};
    for (const error of dryRun.data.errors) {
      (issues[error.row - 2] ??= []).push(formMessage(error.message));
    }
    rows.forEach((row, index) => {
      if (existing.data.includes((row.person_code ?? "").trim())) {
        (issues[index] ??= []).push(
          "รหัสนี้มีในทะเบียนแล้ว — แก้สถานะของคนเดิมได้จากรายการ หรือใช้นำเข้าข้อมูล CSV เพื่ออัปเดตข้อมูล",
        );
      }
    });

    if (Object.keys(issues).length > 0) {
      setRowIssues(
        Object.fromEntries(
          Object.entries(issues).map(([index, list]) => [index, list.join(" · ")]),
        ),
      );
      return setState({ phase: "editing" });
    }
    setState({ phase: "checked", preview: dryRun.data });
  };

  const commit = async (rows: ImportRow[]) => {
    if (state.phase !== "checked") return;
    const preview = state.preview;
    setState({ phase: "committing", preview });
    setFailure(null);
    const result = await callImport("commit", toImportCsv(rows));
    if (!result.ok || result.data.mode !== "commit") {
      setFailure(result.ok ? { message: "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง" } : result.error);
      return setState({ phase: "editing" });
    }
    setState({ phase: "done", outcome: result.data });
  };

  return { state, rowIssues, failure, touched, check, commit };
}
