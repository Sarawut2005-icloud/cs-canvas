"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AddIcon } from "../../components/icons";
import type { StaffType } from "../../lib/api";
import { STAFF_TYPE_LABELS } from "../../lib/people";
import Modal from "../_components/Modal";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../_components/ui";
import AddPeopleStatus from "../people/AddPeopleStatus";
import TextField from "../people/TextField";
import type { PeopleFormOptions } from "../people/form-options";
import { useAddPeople, type ImportRow } from "../people/useAddPeople";

/** อาจารย์ → role lecturer · เจ้าหน้าที่ → role staff (ตอนเข้า MJU SSO ครั้งแรก) */
type Kind = "LECTURER" | "STAFF";

const OFFICE_TYPES: Exclude<StaffType, "LECTURER">[] = ["OFFICER", "TECHNICIAN", "OTHER"];

type Values = {
  personCode: string;
  academicTitle: string;
  fullNameTh: string;
  fullNameEn: string;
  email: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function problemOf(field: keyof Values, value: string): string | null {
  const v = value.trim();
  if ((field === "personCode" || field === "fullNameTh" || field === "email") && !v)
    return "จำเป็นต้องกรอก";
  if (field === "email" && !EMAIL.test(v)) return "รูปแบบอีเมลไม่ถูกต้อง";
  return null;
}

/**
 * "เพิ่มบุคลากร" — one person through the same import as a CSV (handoff ข.2).
 * Choosing อาจารย์ or เจ้าหน้าที่ is required: it sets `staff_type`, which
 * decides the account's role when the person first signs in with MJU SSO.
 */
export default function AddStaffButton({ options }: { options: PeopleFormOptions }) {
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
        เพิ่มบุคลากร
      </button>
      {open && (
        <Modal title="เพิ่มบุคลากร" size="lg" onClose={close}>
          <AddStaffForm options={options} onClose={close} />
        </Modal>
      )}
    </>
  );
}

function AddStaffForm({ options, onClose }: { options: PeopleFormOptions; onClose: () => void }) {
  const id = useId();
  const [kind, setKind] = useState<Kind | "">("");
  const [officeType, setOfficeType] = useState<(typeof OFFICE_TYPES)[number]>("OFFICER");
  const [values, setValues] = useState<Values>({
    personCode: "",
    academicTitle: "",
    fullNameTh: "",
    fullNameEn: "",
    email: "",
  });
  const [facultyCode, setFacultyCode] = useState(options.faculties[0]?.code ?? "");
  const [departmentCode, setDepartmentCode] = useState(
    options.departments.find((d) => d.facultyCode === options.faculties[0]?.code)?.code ?? "",
  );
  const [problems, setProblems] = useState<Partial<Record<keyof Values | "kind", string>>>({});
  const { state, rowIssues, failure, touched, check, commit } = useAddPeople();

  const busy = state.phase === "checking" || state.phase === "committing";
  const done = state.phase === "done";
  const departments = options.departments.filter((d) => d.facultyCode === facultyCode);

  const set = (field: keyof Values, value: string) => {
    touched();
    setValues((current) => ({ ...current, [field]: value }));
  };
  const blur = (field: keyof Values) =>
    setProblems((current) => ({ ...current, [field]: problemOf(field, values[field]) ?? undefined }));

  const toImport = (): ImportRow[] => [
    {
      person_code: values.personCode,
      person_type: "STAFF",
      staff_type: kind === "LECTURER" ? "LECTURER" : officeType,
      full_name_th: values.fullNameTh,
      full_name_en: values.fullNameEn,
      academic_title: values.academicTitle,
      university_email: values.email,
      faculty_code: facultyCode,
      department_code: departmentCode,
      status: "ACTIVE",
    },
  ];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state.phase === "checked") return commit(toImport());

    const found: Partial<Record<keyof Values | "kind", string>> = {};
    if (!kind) found.kind = "กรุณาเลือกว่าเป็นอาจารย์หรือเจ้าหน้าที่";
    for (const field of Object.keys(values) as (keyof Values)[]) {
      const problem = problemOf(field, values[field]);
      if (problem) found[field] = problem;
    }
    setProblems(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(first === "kind" ? `${id}-kind-LECTURER` : `${id}-${first}`)?.focus();
      return;
    }
    await check(toImport());
  };

  const problemCount = Object.values(problems).filter(Boolean).length;

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-body-md text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>

      <fieldset disabled={busy || done} className="space-y-4">
        <fieldset
          aria-required="true"
          aria-describedby={problems.kind ? `${id}-kind-problem` : `${id}-kind-hint`}
          className="space-y-2"
        >
          <legend className="text-label-md text-on-surface">ประเภทบุคลากร *</legend>
          <div className="flex flex-wrap gap-3">
            {(
              [
                ["LECTURER", "อาจารย์"],
                ["STAFF", "เจ้าหน้าที่"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                htmlFor={`${id}-kind-${value}`}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-label-md ${
                  kind === value
                    ? "border-primary-container bg-primary-container/5 text-primary-container"
                    : "border-outline-variant text-on-surface"
                }`}
              >
                <input
                  id={`${id}-kind-${value}`}
                  type="radio"
                  name={`${id}-kind`}
                  value={value}
                  checked={kind === value}
                  onChange={() => {
                    touched();
                    setKind(value);
                    setProblems((current) => ({ ...current, kind: undefined }));
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          <p id={`${id}-kind-hint`} className="text-label-sm text-on-surface-variant">
            กำหนดบทบาทของบัญชีเมื่อเข้า MJU SSO ครั้งแรก — อาจารย์ได้บทบาท lecturer · เจ้าหน้าที่ได้บทบาท staff
          </p>
          {problems.kind && (
            <p id={`${id}-kind-problem`} className="text-label-sm text-error">
              {problems.kind}
            </p>
          )}
        </fieldset>

        {kind === "STAFF" && (
          <div className="space-y-2">
            <label htmlFor={`${id}-office`} className="block text-label-md text-on-surface">
              ลักษณะงาน
            </label>
            <select
              id={`${id}-office`}
              value={officeType}
              onChange={(event) => {
                touched();
                setOfficeType(event.target.value as (typeof OFFICE_TYPES)[number]);
              }}
              className={inputClass}
            >
              {OFFICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {STAFF_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id={`${id}-personCode`}
            label="รหัสบุคลากร *"
            required
            value={values.personCode}
            problem={problems.personCode}
            onChange={(v) => set("personCode", v)}
            onBlur={() => blur("personCode")}
          />
          <TextField
            id={`${id}-academicTitle`}
            label="ตำแหน่งทางวิชาการ"
            hint="เช่น ผศ.ดร. หรือ อ. — เว้นว่างได้"
            value={values.academicTitle}
            onChange={(v) => set("academicTitle", v)}
          />
          <TextField
            id={`${id}-fullNameTh`}
            label="ชื่อ-สกุล (ไทย) *"
            required
            value={values.fullNameTh}
            problem={problems.fullNameTh}
            onChange={(v) => set("fullNameTh", v)}
            onBlur={() => blur("fullNameTh")}
          />
          <TextField
            id={`${id}-fullNameEn`}
            label="ชื่อ-สกุล (อังกฤษ)"
            value={values.fullNameEn}
            onChange={(v) => set("fullNameEn", v)}
          />
        </div>

        <TextField
          id={`${id}-email`}
          label="อีเมลมหาวิทยาลัย *"
          type="email"
          required
          hint="ใช้จับคู่บัญชีตอนเข้าสู่ระบบด้วย MJU SSO — ต้องตรงกับอีเมลที่มหาวิทยาลัยออกให้"
          value={values.email}
          problem={problems.email}
          onChange={(v) => set("email", v)}
          onBlur={() => blur("email")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor={`${id}-faculty`} className="block text-label-md text-on-surface">
              คณะ *
            </label>
            <select
              id={`${id}-faculty`}
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
            <label htmlFor={`${id}-department`} className="block text-label-md text-on-surface">
              สาขา
            </label>
            <select
              id={`${id}-department`}
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
        </div>
      </fieldset>

      <div aria-live="polite" className="space-y-2">
        {problemCount > 0 && (
          <p className="text-label-sm text-error">ยังกรอกไม่ครบหรือไม่ถูกต้อง {problemCount} ช่อง</p>
        )}
        {rowIssues[0] && (
          <p role="alert" className="text-label-md text-error">
            {rowIssues[0]}
          </p>
        )}
        <AddPeopleStatus state={state} failure={failure} issueCount={0} />
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
                    ? "บันทึก"
                    : "ตรวจสอบ"}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
