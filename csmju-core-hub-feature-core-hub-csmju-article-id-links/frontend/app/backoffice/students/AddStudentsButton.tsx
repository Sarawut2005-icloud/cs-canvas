"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { AddIcon, DeleteIcon } from "../../components/icons";
import Modal from "../_components/Modal";
import {
  iconDangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../_components/ui";
import AddPeopleStatus from "../people/AddPeopleStatus";
import TextField from "../people/TextField";
import type { PeopleFormOptions } from "../people/form-options";
import { useAddPeople, type ImportRow } from "../people/useAddPeople";

type StudentRow = {
  key: number;
  personCode: string;
  fullNameTh: string;
  fullNameEn: string;
  email: string;
  entryYear: string;
  curriculumCode: string;
};

type FieldKey = Exclude<keyof StudentRow, "key">;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side check on blur and on submit — the import checks again. */
function problemOf(field: FieldKey, value: string): string | null {
  const v = value.trim();
  if ((field === "personCode" || field === "fullNameTh") && !v) return "จำเป็นต้องกรอก";
  if (field === "entryYear" && v && !/^\d{4}$/.test(v)) return "ปี พ.ศ. 4 หลัก เช่น 2569";
  if (field === "email" && v && !EMAIL.test(v)) return "รูปแบบอีเมลไม่ถูกต้อง";
  return null;
}

function blankRow(key: number): StudentRow {
  return { key, personCode: "", fullNameTh: "", fullNameEn: "", email: "", entryYear: "", curriculumCode: "" };
}

const FIELDS: FieldKey[] = ["personCode", "fullNameTh", "fullNameEn", "email", "entryYear", "curriculumCode"];

/**
 * "เพิ่มนักศึกษา" — several students in one go (handoff 2.3 · B3). "+" adds a
 * row, each row can be removed, and the whole list is checked (dry-run) then
 * saved (commit) through the same import as a CSV file.
 */
export default function AddStudentsButton({ options }: { options: PeopleFormOptions }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const close = () => {
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        <AddIcon className="h-4 w-4" />
        เพิ่มนักศึกษา
      </button>
      {open && (
        <Modal title="เพิ่มนักศึกษา" size="xl" onClose={close}>
          <AddStudentsForm options={options} onClose={close} />
        </Modal>
      )}
    </>
  );
}

function AddStudentsForm({
  options,
  onClose,
}: {
  options: PeopleFormOptions;
  onClose: () => void;
}) {
  const formId = useId();
  const nextKey = useRef(1);
  const [rows, setRows] = useState<StudentRow[]>(() => [blankRow(0)]);
  const [facultyCode, setFacultyCode] = useState(options.faculties[0]?.code ?? "");
  const [departmentCode, setDepartmentCode] = useState(
    options.departments.find((d) => d.facultyCode === options.faculties[0]?.code)?.code ?? "",
  );
  const [problems, setProblems] = useState<Record<string, string>>({});
  const { state, rowIssues, failure, touched, check, commit } = useAddPeople();

  const busy = state.phase === "checking" || state.phase === "committing";
  const done = state.phase === "done";
  const departments = options.departments.filter((d) => d.facultyCode === facultyCode);
  const curricula = options.curricula.filter(
    (c) => !departmentCode || c.departmentCode === departmentCode,
  );

  const idFor = (row: StudentRow, field: FieldKey) => `${formId}-${row.key}-${field}`;

  const update = (key: number, field: FieldKey, value: string) => {
    touched();
    setRows((current) => current.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const blur = (row: StudentRow, field: FieldKey) => {
    const problem = problemOf(field, row[field]);
    setProblems((current) => {
      const next = { ...current };
      if (problem) next[idFor(row, field)] = problem;
      else delete next[idFor(row, field)];
      return next;
    });
  };

  const toImport = (): ImportRow[] =>
    rows.map((r) => ({
      person_code: r.personCode,
      person_type: "STUDENT",
      full_name_th: r.fullNameTh,
      full_name_en: r.fullNameEn,
      university_email: r.email,
      entry_year: r.entryYear,
      faculty_code: facultyCode,
      department_code: departmentCode,
      curriculum_code: r.curriculumCode,
      status: "ACTIVE",
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state.phase === "checked") return commit(toImport());

    const found: Record<string, string> = {};
    for (const row of rows) {
      for (const field of FIELDS) {
        const problem = problemOf(field, row[field]);
        if (problem) found[idFor(row, field)] = problem;
      }
    }
    if (!facultyCode) found[`${formId}-faculty`] = "จำเป็นต้องเลือก";
    setProblems(found);
    const firstId = Object.keys(found)[0];
    if (firstId) {
      document.getElementById(firstId)?.focus();
      return;
    }
    await check(toImport());
  };

  const issueCount = Object.keys(rowIssues).length;
  const problemCount = Object.keys(problems).length;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <p className="text-body-md text-on-surface-variant">
        ช่องที่มี * จำเป็นต้องกรอก · นักศึกษาที่มีอีเมลมหาวิทยาลัยจะได้บัญชีผู้ใช้อัตโนมัติ
        (เข้าครั้งแรกด้วย MJU SSO แล้วตั้งรหัสผ่านเอง)
      </p>

      <fieldset disabled={busy || done} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">สังกัดของนักศึกษาทุกแถว</legend>
        <div className="space-y-2">
          <label htmlFor={`${formId}-faculty`} className="block text-label-md text-on-surface">
            คณะ *
          </label>
          <select
            id={`${formId}-faculty`}
            aria-required="true"
            value={facultyCode}
            onChange={(event) => {
              touched();
              setFacultyCode(event.target.value);
              setDepartmentCode(
                options.departments.find((d) => d.facultyCode === event.target.value)?.code ?? "",
              );
            }}
            className={inputClass}
          >
            {options.faculties.map((f) => (
              <option key={f.code} value={f.code}>
                {f.nameTh} ({f.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor={`${formId}-department`} className="block text-label-md text-on-surface">
            สาขา
          </label>
          <select
            id={`${formId}-department`}
            value={departmentCode}
            onChange={(event) => {
              touched();
              setDepartmentCode(event.target.value);
            }}
            className={inputClass}
          >
            <option value="">— ไม่ระบุ —</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.nameTh} ({d.code})
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <ol className="space-y-3">
        {rows.map((row, index) => {
          const issue = rowIssues[index];
          return (
            <li
              key={row.key}
              className={`rounded-xl border p-4 ${
                issue ? "border-error/50 bg-error/5" : "border-outline-variant/40"
              }`}
            >
              <fieldset disabled={busy || done} aria-label={`แถวที่ ${index + 1}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p aria-hidden className="text-label-md text-on-surface">
                    แถวที่ {index + 1}
                  </p>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        touched();
                        setRows((current) => current.filter((r) => r.key !== row.key));
                      }}
                      aria-label={`ลบแถวที่ ${index + 1}`}
                      className={iconDangerButtonClass}
                    >
                      <DeleteIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <TextField
                    id={idFor(row, "personCode")}
                    label="รหัสนักศึกษา *"
                    required
                    inputMode="numeric"
                    value={row.personCode}
                    problem={problems[idFor(row, "personCode")]}
                    onChange={(v) => update(row.key, "personCode", v)}
                    onBlur={() => blur(row, "personCode")}
                  />
                  <TextField
                    id={idFor(row, "fullNameTh")}
                    label="ชื่อ-สกุล (ไทย) *"
                    required
                    value={row.fullNameTh}
                    problem={problems[idFor(row, "fullNameTh")]}
                    onChange={(v) => update(row.key, "fullNameTh", v)}
                    onBlur={() => blur(row, "fullNameTh")}
                  />
                  <TextField
                    id={idFor(row, "fullNameEn")}
                    label="ชื่อ-สกุล (อังกฤษ)"
                    value={row.fullNameEn}
                    onChange={(v) => update(row.key, "fullNameEn", v)}
                  />
                  <TextField
                    id={idFor(row, "email")}
                    label="อีเมลมหาวิทยาลัย"
                    type="email"
                    value={row.email}
                    problem={problems[idFor(row, "email")]}
                    onChange={(v) => update(row.key, "email", v)}
                    onBlur={() => blur(row, "email")}
                  />
                  <TextField
                    id={idFor(row, "entryYear")}
                    label="ปีที่เข้า (พ.ศ.)"
                    inputMode="numeric"
                    value={row.entryYear}
                    problem={problems[idFor(row, "entryYear")]}
                    onChange={(v) => update(row.key, "entryYear", v)}
                    onBlur={() => blur(row, "entryYear")}
                  />
                  <div className="space-y-2">
                    <label htmlFor={idFor(row, "curriculumCode")} className="block text-label-md text-on-surface">
                      หลักสูตร
                    </label>
                    <select
                      id={idFor(row, "curriculumCode")}
                      value={row.curriculumCode}
                      onChange={(event) => update(row.key, "curriculumCode", event.target.value)}
                      className={inputClass}
                    >
                      <option value="">— ไม่ระบุ —</option>
                      {curricula.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.nameTh} ({c.curriculumYear})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {issue && (
                  <p role="alert" className="mt-3 text-label-md text-error">
                    {issue}
                  </p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {!done && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            touched();
            setRows((current) => [...current, blankRow(nextKey.current++)]);
          }}
          className={`${secondaryButtonClass} inline-flex items-center gap-2`}
        >
          <AddIcon className="h-4 w-4" />
          เพิ่มแถว
        </button>
      )}

      <div aria-live="polite" className="space-y-2">
        {problemCount > 0 && (
          <p className="text-label-sm text-error">ยังกรอกไม่ครบหรือไม่ถูกต้อง {problemCount} ช่อง</p>
        )}
        <AddPeopleStatus state={state} failure={failure} issueCount={issueCount} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {done ? (
          <button type="button" onClick={onClose} className={primaryButtonClass}>
            เสร็จสิ้น
          </button>
        ) : (
          <>
            <button type="button" onClick={onClose} className={secondaryButtonClass}>
              ยกเลิก
            </button>
            <button type="submit" disabled={busy} className={`${primaryButtonClass} disabled:opacity-60`}>
              {state.phase === "checking"
                ? "กำลังตรวจสอบ..."
                : state.phase === "committing"
                  ? "กำลังบันทึก..."
                  : state.phase === "checked"
                    ? `บันทึก ${rows.length} คน`
                    : "ตรวจสอบ"}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
