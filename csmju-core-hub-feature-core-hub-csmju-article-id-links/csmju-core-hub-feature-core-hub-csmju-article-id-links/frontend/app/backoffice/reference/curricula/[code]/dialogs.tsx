"use client";

import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import type { CurriculumCategory } from "../../../../lib/public-curricula";
import type { ActionResult } from "../../../../lib/subsystems";
import Modal from "../../../_components/Modal";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../../_components/ui";
import {
  saveCourse,
  saveCreditRule,
  saveGroup,
  saveSlot,
  searchCourses,
  type CourseOption,
} from "./actions";
import {
  CATEGORY_OPTIONS,
  SEMESTER_LABEL,
  type CourseGroup,
  type CreditRule,
  type CurriculumModel,
  type PlanCourse,
  type PlanSlot,
} from "./model";

/** Years an admin may place a course in (the API allows 1–8). */
const YEARS = [1, 2, 3, 4, 5, 6, 7, 8];
const SEMESTERS = [1, 2, 3];

type Saved = (message: string) => void;

/* ------------------------------------------------------------------ */
/* Form plumbing                                                       */
/* ------------------------------------------------------------------ */

function Field({
  id,
  label,
  hint,
  problem,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  problem?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-label-md text-on-surface">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-label-sm text-on-surface-variant">
          {hint}
        </p>
      )}
      {problem && (
        <p id={`${id}-problem`} className="text-label-sm text-error">
          {problem}
        </p>
      )}
    </div>
  );
}

function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-body-md text-on-surface">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Shared submit flow: run the action, show its error, report success. */
function useSave(onSaved: Saved) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const save = (run: () => Promise<ActionResult<unknown>>, message: string) =>
    startTransition(async () => {
      setError(null);
      const result = await run();
      if (!result.ok) return setError(result.error);
      onSaved(message);
    });
  return { error, pending, save };
}

function Footer({ pending, error, onClose }: { pending: boolean; error: string | null; onClose: () => void }) {
  return (
    <>
      {error && (
        <p role="alert" className="text-label-sm text-error">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className={secondaryButtonClass}>
          ยกเลิก
        </button>
        <button type="submit" disabled={pending} className={`${primaryButtonClass} disabled:opacity-60`}>
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </>
  );
}

/** "" → null, otherwise an integer (NaN when not a whole number). */
function toInt(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  return /^\d+$/.test(v) ? Number(v) : Number.NaN;
}

/* ------------------------------------------------------------------ */
/* Credit rule                                                         */
/* ------------------------------------------------------------------ */

export function CreditRuleDialog({
  code,
  rule,
  taken,
  onClose,
  onSaved,
}: {
  code: string;
  rule: CreditRule | null;
  taken: CurriculumCategory[];
  onClose: () => void;
  onSaved: Saved;
}) {
  const id = useId();
  const free = CATEGORY_OPTIONS.filter((o) => !taken.includes(o.value));
  const [category, setCategory] = useState<CurriculumCategory | "">(rule?.category ?? free[0]?.value ?? "");
  const [minCredits, setMinCredits] = useState(rule ? String(rule.minCredits) : "");
  const [problem, setProblem] = useState<string | null>(null);
  const { error, pending, save } = useSave(onSaved);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const credits = toInt(minCredits);
    if (credits === null || Number.isNaN(credits)) {
      setProblem("กรอกจำนวนหน่วยกิตเป็นจำนวนเต็ม");
      return document.getElementById(`${id}-credits`)?.focus();
    }
    if (!category) return;
    save(() => saveCreditRule(code, category, credits), "บันทึกเกณฑ์หน่วยกิตแล้ว");
  };

  return (
    <Modal title={rule ? "แก้ไขเกณฑ์หน่วยกิต" : "เพิ่มเกณฑ์หน่วยกิต"} onClose={onClose}>
      {!rule && free.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">ทุกหมวดมีเกณฑ์หน่วยกิตแล้ว — แก้ไขจากรายการแทน</p>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <p className="text-label-sm text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>
          <Field id={`${id}-category`} label="หมวด *">
            <select
              id={`${id}-category`}
              value={category}
              disabled={Boolean(rule)}
              onChange={(e) => setCategory(e.target.value as CurriculumCategory)}
              className={inputClass}
            >
              {(rule ? CATEGORY_OPTIONS.filter((o) => o.value === rule.category) : free).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-credits`} label="หน่วยกิตขั้นต่ำ *" problem={problem}>
            <input
              id={`${id}-credits`}
              inputMode="numeric"
              aria-required="true"
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? `${id}-credits-problem` : undefined}
              value={minCredits}
              onChange={(e) => setMinCredits(e.target.value)}
              onBlur={() => setProblem(Number.isNaN(toInt(minCredits) ?? Number.NaN) ? "กรอกจำนวนหน่วยกิตเป็นจำนวนเต็ม" : null)}
              className={inputClass}
            />
          </Field>
          <Footer pending={pending} error={error} onClose={onClose} />
        </form>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Course group                                                        */
/* ------------------------------------------------------------------ */

export function GroupDialog({
  code,
  group,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  code: string;
  group: CourseGroup | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: Saved;
}) {
  const id = useId();
  const [category, setCategory] = useState<CurriculumCategory>(group?.category ?? "MAJOR_REQUIRED");
  const [parentNameTh, setParentNameTh] = useState(group?.parentNameTh ?? "");
  const [nameTh, setNameTh] = useState(group?.nameTh ?? "");
  const [listedCredits, setListedCredits] = useState(group?.listedCredits?.toString() ?? "");
  const [available, setAvailable] = useState(group?.availableCourseCount?.toString() ?? "");
  const [sortOrder, setSortOrder] = useState(String(group?.sortOrder ?? nextSortOrder));
  const [problems, setProblems] = useState<Record<string, string>>({});
  const { error, pending, save } = useSave(onSaved);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!parentNameTh.trim()) found.parent = "จำเป็นต้องกรอก";
    if (!nameTh.trim()) found.name = "จำเป็นต้องกรอก";
    const credits = toInt(listedCredits);
    const count = toInt(available);
    const order = toInt(sortOrder);
    if (Number.isNaN(credits)) found.credits = "กรอกเป็นจำนวนเต็ม หรือเว้นว่าง";
    if (Number.isNaN(count)) found.count = "กรอกเป็นจำนวนเต็ม หรือเว้นว่าง";
    if (order === null || Number.isNaN(order)) found.order = "กรอกเป็นจำนวนเต็ม";
    setProblems(found);
    const first = Object.keys(found)[0];
    if (first) return document.getElementById(`${id}-${first}`)?.focus();

    save(
      () =>
        saveGroup(code, group?.key ?? null, {
          category,
          parentNameTh: parentNameTh.trim(),
          nameTh: nameTh.trim(),
          listedCredits: credits,
          availableCourseCount: count,
          sortOrder: order as number,
        }),
      group ? `แก้ไขกลุ่ม "${nameTh.trim()}" แล้ว` : `เพิ่มกลุ่ม "${nameTh.trim()}" แล้ว`,
    );
  };

  const input = (key: string, value: string, set: (v: string) => void, numeric = false) => (
    <input
      id={`${id}-${key}`}
      value={value}
      inputMode={numeric ? "numeric" : undefined}
      aria-invalid={problems[key] ? true : undefined}
      aria-describedby={problems[key] ? `${id}-${key}-problem` : undefined}
      onChange={(e) => set(e.target.value)}
      className={inputClass}
    />
  );

  return (
    <Modal title={group ? "แก้ไขกลุ่มวิชา" : "เพิ่มกลุ่มวิชา"} size="lg" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-label-sm text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>
        <Field id={`${id}-category`} label="หมวด *">
          <select
            id={`${id}-category`}
            value={category}
            onChange={(e) => setCategory(e.target.value as CurriculumCategory)}
            className={inputClass}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-parent`} label="หมวด/กลุ่มหลัก *" hint="เช่น หมวดวิชาเฉพาะ" problem={problems.parent}>
          {input("parent", parentNameTh, setParentNameTh)}
        </Field>
        <Field id={`${id}-name`} label="ชื่อกลุ่มวิชา *" hint="ไม่ซ้ำกับกลุ่มอื่นในหลักสูตรนี้" problem={problems.name}>
          {input("name", nameTh, setNameTh)}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={`${id}-credits`} label="หน่วยกิตของกลุ่ม" problem={problems.credits}>
            {input("credits", listedCredits, setListedCredits, true)}
          </Field>
          <Field id={`${id}-count`} label="จำนวนวิชาให้เลือก" problem={problems.count}>
            {input("count", available, setAvailable, true)}
          </Field>
          <Field id={`${id}-order`} label="ลำดับที่แสดง *" problem={problems.order}>
            {input("order", sortOrder, setSortOrder, true)}
          </Field>
        </div>
        <Footer pending={pending} error={error} onClose={onClose} />
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Course in the curriculum                                            */
/* ------------------------------------------------------------------ */

export function CourseDialog({
  code,
  course,
  preset,
  model,
  onClose,
  onSaved,
}: {
  code: string;
  course: PlanCourse | null;
  preset?: { groupKey?: string | null; year?: number; semester?: number };
  model: CurriculumModel;
  onClose: () => void;
  onSaved: Saved;
}) {
  const id = useId();
  const presetGroup = model.groups.find((g) => g.key === preset?.groupKey);
  const [courseCode, setCourseCode] = useState(course?.courseCode ?? "");
  const [category, setCategory] = useState<CurriculumCategory>(
    course?.category ?? presetGroup?.category ?? "MAJOR_REQUIRED",
  );
  const [groupKey, setGroupKey] = useState<string>(course?.groupKey ?? preset?.groupKey ?? "");
  const [isRequired, setIsRequired] = useState(course?.isRequired ?? true);
  const [year, setYear] = useState(String(course?.recommendedYear ?? preset?.year ?? ""));
  const [semester, setSemester] = useState(String(course?.recommendedSemester ?? preset?.semester ?? ""));
  const [choiceGroup, setChoiceGroup] = useState(course?.choiceGroup ?? "");
  const [counted, setCounted] = useState(course?.isCountedInPlan ?? true);
  const [planNote, setPlanNote] = useState(course?.planNote ?? "");
  const [options, setOptions] = useState<CourseOption[]>([]);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const { error, pending, save } = useSave(onSaved);

  const typed = courseCode.trim();
  // Typing the code of a course already in this curriculum moves it instead.
  const existing = course ?? model.courses.find((c) => c.courseCode === typed) ?? null;

  useEffect(() => {
    if (course || typed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await searchCourses(typed);
      if (!cancelled && result.ok) setOptions(result.data);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [typed, course]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!typed) found.code = "จำเป็นต้องกรอก";
    if ((year === "") !== (semester === "")) found.semester = "เลือกชั้นปีและภาคเรียนคู่กัน หรือเว้นว่างทั้งคู่";
    setProblems(found);
    const first = Object.keys(found)[0];
    if (first) return document.getElementById(`${id}-${first}`)?.focus();

    const body = {
      category,
      courseGroupId: groupKey || null,
      isRequired,
      choiceGroup: choiceGroup.trim() || null,
      isCountedInPlan: counted,
      planNote: planNote.trim() || null,
      recommendedYear: year ? Number(year) : null,
      recommendedSemester: semester ? Number(semester) : null,
    };
    save(
      () => saveCourse(code, typed, existing !== null, body),
      existing ? `บันทึก ${typed} แล้ว` : `เพิ่ม ${typed} ในหลักสูตรแล้ว`,
    );
  };

  return (
    <Modal title={course ? `แก้ไขรายวิชา ${course.courseCode}` : "เพิ่มรายวิชาในหลักสูตร"} size="lg" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-label-sm text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>
        {course ? (
          <p className="rounded-lg bg-surface-container-low px-4 py-3 text-body-md text-on-surface">
            <span className="tabular-nums">{course.courseCode}</span> {course.nameTh} ·{" "}
            {course.creditPattern ?? `${course.credits} หน่วยกิต`}
          </p>
        ) : (
          <Field
            id={`${id}-code`}
            label="รหัสวิชา *"
            hint={
              existing
                ? "รายวิชานี้อยู่ในหลักสูตรแล้ว — บันทึกจะแก้รายการเดิม (เช่น ย้ายไปภาคนี้)"
                : "พิมพ์รหัสหรือชื่อวิชาอย่างน้อย 2 ตัวอักษรเพื่อค้นหาจากข้อมูลอ้างอิงรายวิชา"
            }
            problem={problems.code}
          >
            <input
              id={`${id}-code`}
              list={`${id}-courses`}
              aria-required="true"
              aria-invalid={problems.code ? true : undefined}
              aria-describedby={`${id}-code-hint${problems.code ? ` ${id}-code-problem` : ""}`}
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              className={inputClass}
            />
            <datalist id={`${id}-courses`}>
              {options.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.nameTh} ({o.credits} หน่วยกิต)
                </option>
              ))}
            </datalist>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-category`} label="หมวด *">
            <select
              id={`${id}-category`}
              value={category}
              onChange={(e) => setCategory(e.target.value as CurriculumCategory)}
              className={inputClass}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-group`} label="กลุ่มวิชา">
            <select id={`${id}-group`} value={groupKey} onChange={(e) => setGroupKey(e.target.value)} className={inputClass}>
              <option value="">— ไม่อยู่ในกลุ่ม —</option>
              {model.groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.nameTh}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-year`} label="ชั้นปีในแผน">
            <select id={`${id}-year`} value={year} onChange={(e) => setYear(e.target.value)} className={inputClass}>
              <option value="">— ไม่อยู่ในแผน —</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  ชั้นปีที่ {y}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-semester`} label="ภาคเรียนในแผน" problem={problems.semester}>
            <select
              id={`${id}-semester`}
              value={semester}
              aria-invalid={problems.semester ? true : undefined}
              aria-describedby={problems.semester ? `${id}-semester-problem` : undefined}
              onChange={(e) => setSemester(e.target.value)}
              className={inputClass}
            >
              <option value="">— ไม่อยู่ในแผน —</option>
              {SEMESTERS.map((s) => (
                <option key={s} value={s}>
                  {SEMESTER_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-choice`} label="กลุ่มเลือกเรียน 1 วิชา" hint="เช่น Y4S1 — วิชาที่ใส่ค่าเดียวกันให้เลือกเรียนหนึ่งวิชา">
            <input id={`${id}-choice`} value={choiceGroup} onChange={(e) => setChoiceGroup(e.target.value)} className={inputClass} />
          </Field>
          <Field id={`${id}-note`} label="หมายเหตุในแผน">
            <input id={`${id}-note`} value={planNote} onChange={(e) => setPlanNote(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <Checkbox id={`${id}-required`} label="วิชาบังคับ" checked={isRequired} onChange={setIsRequired} />
          <Checkbox id={`${id}-counted`} label="นับหน่วยกิตในแผน" checked={counted} onChange={setCounted} />
        </div>
        <Footer pending={pending} error={error} onClose={onClose} />
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Elective slot in the plan                                           */
/* ------------------------------------------------------------------ */

export function SlotDialog({
  code,
  slot,
  preset,
  groups,
  onClose,
  onSaved,
}: {
  code: string;
  slot: PlanSlot | null;
  preset?: { year: number; semester: number };
  groups: CourseGroup[];
  onClose: () => void;
  onSaved: Saved;
}) {
  const id = useId();
  const [label, setLabel] = useState(slot?.label ?? "");
  const [category, setCategory] = useState<CurriculumCategory>(slot?.category ?? "MAJOR_ELECTIVE");
  const [year, setYear] = useState(String(slot?.recommendedYear ?? preset?.year ?? 1));
  const [semester, setSemester] = useState(String(slot?.recommendedSemester ?? preset?.semester ?? 1));
  const [slotCount, setSlotCount] = useState(String(slot?.slotCount ?? 1));
  const [creditsPerSlot, setCreditsPerSlot] = useState(String(slot?.creditsPerSlot ?? 3));
  const [groupKey, setGroupKey] = useState(slot?.groupKey ?? "");
  const [note, setNote] = useState(slot?.note ?? "");
  const [problems, setProblems] = useState<Record<string, string>>({});
  const { error, pending, save } = useSave(onSaved);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!label.trim()) found.label = "จำเป็นต้องกรอก";
    const count = toInt(slotCount);
    const credits = toInt(creditsPerSlot);
    if (count === null || Number.isNaN(count) || count < 1) found.count = "กรอกจำนวนเต็มตั้งแต่ 1";
    if (credits === null || Number.isNaN(credits)) found.credits = "กรอกเป็นจำนวนเต็ม";
    setProblems(found);
    const first = Object.keys(found)[0];
    if (first) return document.getElementById(`${id}-${first}`)?.focus();

    save(
      () =>
        saveSlot(code, slot?.key ?? null, {
          category,
          label: label.trim(),
          recommendedYear: Number(year),
          recommendedSemester: Number(semester),
          slotCount: count as number,
          creditsPerSlot: credits as number,
          courseGroupId: groupKey || null,
          note: note.trim() || null,
        }),
      slot ? `แก้ไขช่อง "${label.trim()}" แล้ว` : `เพิ่มช่อง "${label.trim()}" แล้ว`,
    );
  };

  const numeric = (key: string, value: string, set: (v: string) => void) => (
    <input
      id={`${id}-${key}`}
      inputMode="numeric"
      aria-required="true"
      aria-invalid={problems[key] ? true : undefined}
      aria-describedby={problems[key] ? `${id}-${key}-problem` : undefined}
      value={value}
      onChange={(e) => set(e.target.value)}
      className={inputClass}
    />
  );

  return (
    <Modal title={slot ? "แก้ไขช่องวิชาเลือก" : "เพิ่มช่องวิชาเลือก"} size="lg" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-label-sm text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>
        <Field id={`${id}-label`} label="ชื่อช่อง *" hint="เช่น วิชาเอกเลือก — ไม่ซ้ำกับช่องอื่นในภาคเดียวกัน" problem={problems.label}>
          <input
            id={`${id}-label`}
            aria-required="true"
            aria-invalid={problems.label ? true : undefined}
            aria-describedby={`${id}-label-hint${problems.label ? ` ${id}-label-problem` : ""}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-category`} label="หมวด *">
            <select
              id={`${id}-category`}
              value={category}
              onChange={(e) => setCategory(e.target.value as CurriculumCategory)}
              className={inputClass}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-group`} label="กลุ่มวิชาที่เลือกได้">
            <select id={`${id}-group`} value={groupKey} onChange={(e) => setGroupKey(e.target.value)} className={inputClass}>
              <option value="">— ไม่ระบุ —</option>
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.nameTh}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-year`} label="ชั้นปี *">
            <select id={`${id}-year`} value={year} onChange={(e) => setYear(e.target.value)} className={inputClass}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  ชั้นปีที่ {y}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-semester`} label="ภาคเรียน *">
            <select id={`${id}-semester`} value={semester} onChange={(e) => setSemester(e.target.value)} className={inputClass}>
              {SEMESTERS.map((s) => (
                <option key={s} value={s}>
                  {SEMESTER_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-count`} label="จำนวนวิชา *" problem={problems.count}>
            {numeric("count", slotCount, setSlotCount)}
          </Field>
          <Field id={`${id}-credits`} label="หน่วยกิตต่อวิชา *" problem={problems.credits}>
            {numeric("credits", creditsPerSlot, setCreditsPerSlot)}
          </Field>
        </div>
        <Field id={`${id}-note`} label="หมายเหตุ">
          <input id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </Field>
        <Footer pending={pending} error={error} onClose={onClose} />
      </form>
    </Modal>
  );
}
