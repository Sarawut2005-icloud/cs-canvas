"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { AddIcon, DeleteIcon, EditIcon, MenuBookIcon } from "../../../../components/icons";
import { CATEGORY_LABELS } from "../../../../lib/public-curricula";
import type { ActionResult } from "../../../../lib/subsystems";
import Modal from "../../../_components/Modal";
import Tabs from "../../../_components/Tabs";
import {
  cardClass,
  dangerButtonClass,
  iconButtonClass,
  iconDangerButtonClass,
  secondaryButtonClass,
} from "../../../_components/ui";
import { EmptyState } from "../../../subsystems/_components/StateViews";
import {
  deleteCreditRule,
  deleteGroup,
  deleteSlot,
  removeCourse,
  saveCourse,
} from "./actions";
import { CourseDialog, CreditRuleDialog, GroupDialog, SlotDialog } from "./dialogs";
import {
  planTerms,
  SEMESTER_LABEL,
  type CourseGroup,
  type CreditRule,
  type CurriculumModel,
  type PlanCourse,
  type PlanSlot,
} from "./model";

type Tab = "structure" | "plan";

export type Dialog =
  | { kind: "rule"; rule: CreditRule | null }
  | { kind: "group"; group: CourseGroup | null }
  | {
      kind: "course";
      course: PlanCourse | null;
      preset?: { groupKey?: string | null; year?: number; semester?: number };
    }
  | { kind: "slot"; slot: PlanSlot | null; preset?: { year: number; semester: number } }
  | {
      kind: "confirm";
      title: string;
      message: ReactNode;
      confirmLabel: string;
      run: () => Promise<ActionResult<unknown>>;
    };

/**
 * The structure and study plan tabs. Read-only for staff and lecturers;
 * admins get add / edit / remove on every item (handoff 2.6). Each write is
 * a server action, then the page re-renders from what the API stored.
 */
export default function CurriculumView({ code, model }: { code: string; model: CurriculumModel }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("structure");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editable = model.editable;

  const saved = (message: string) => {
    setDialog(null);
    setError(null);
    setNotice(message);
    router.refresh();
  };

  /** Quick writes without a dialog (e.g. taking a course out of the plan). */
  const quick = (run: () => Promise<ActionResult<unknown>>, message: string) =>
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        setNotice(null);
        return setError(result.error);
      }
      saved(message);
    });

  const actions: ViewActions = {
    editable,
    pending,
    open: (next) => {
      setNotice(null);
      setError(null);
      setDialog(next);
    },
    removeFromPlan: (course) =>
      quick(
        () =>
          saveCourse(code, course.courseCode, true, {
            recommendedYear: null,
            recommendedSemester: null,
          }),
        `เอา ${course.courseCode} ออกจากแผนการศึกษาแล้ว (ยังอยู่ในโครงสร้างหลักสูตร)`,
      ),
  };

  return (
    <>
      {editable && (
        <p role="note" className="fade-slide-up rounded-lg bg-primary-container/10 px-4 py-3 text-label-md text-on-surface">
          โหมดแก้ไขของผู้ดูแลระบบ — สิ่งที่บันทึกที่นี่คือข้อมูลหลักของหลักสูตร ระบบย่อยและหน้าสาธารณะอ่านค่าใหม่ทันที
        </p>
      )}

      <Tabs
        tabs={[
          { id: "structure", label: "โครงสร้างหลักสูตร" },
          { id: "plan", label: "แผนการศึกษา" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div aria-live="polite">
        {notice && (
          <p role="status" className="rounded-lg bg-success/10 px-4 py-3 text-label-md text-emerald-700">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
            {error}
          </p>
        )}
      </div>

      {tab === "structure" ? (
        <StructureTab code={code} model={model} actions={actions} />
      ) : (
        <PlanTab code={code} model={model} actions={actions} />
      )}

      {dialog?.kind === "rule" && (
        <CreditRuleDialog
          code={code}
          rule={dialog.rule}
          taken={model.creditRules.map((r) => r.category)}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.kind === "group" && (
        <GroupDialog
          code={code}
          group={dialog.group}
          nextSortOrder={Math.max(0, ...model.groups.map((g) => g.sortOrder + 1))}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.kind === "course" && (
        <CourseDialog
          code={code}
          course={dialog.course}
          preset={dialog.preset}
          model={model}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.kind === "slot" && (
        <SlotDialog
          code={code}
          slot={dialog.slot}
          preset={dialog.preset}
          groups={model.groups}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.kind === "confirm" && (
        <ConfirmDialog dialog={dialog} onClose={() => setDialog(null)} onDone={saved} />
      )}
    </>
  );
}

type ViewActions = {
  editable: boolean;
  pending: boolean;
  open: (dialog: Dialog) => void;
  removeFromPlan: (course: PlanCourse) => void;
};

/* ------------------------------------------------------------------ */
/* Structure                                                           */
/* ------------------------------------------------------------------ */

function StructureTab({
  code,
  model,
  actions,
}: {
  code: string;
  model: CurriculumModel;
  actions: ViewActions;
}) {
  const { editable, open } = actions;
  const groups = [...model.groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const ungrouped = model.courses.filter((c) => !c.groupKey);

  const confirmRemoveCourse = (course: PlanCourse) =>
    open({
      kind: "confirm",
      title: "ลบรายวิชาออกจากหลักสูตร",
      confirmLabel: "ลบรายวิชา",
      message: (
        <>
          ลบ <strong className="text-on-surface">{course.courseCode} {course.nameTh}</strong>{" "}
          ออกจากหลักสูตรนี้? รายวิชาจะหายจากโครงสร้างและแผนการศึกษา แต่ยังอยู่ในข้อมูลอ้างอิงรายวิชา
        </>
      ),
      run: () => removeCourse(code, course.courseCode),
    });

  return (
    <div className="space-y-6">
      <section className={`${cardClass}`}>
        <SectionHeader
          title="เกณฑ์หน่วยกิตต่อหมวด"
          action={
            editable && (
              <AddButton label="เพิ่มเกณฑ์หน่วยกิต" onClick={() => open({ kind: "rule", rule: null })} />
            )
          }
        />
        {model.creditRules.length === 0 ? (
          <p className="px-6 py-6 text-body-md text-on-surface-variant">ยังไม่มีเกณฑ์หน่วยกิต</p>
        ) : (
          <ul className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {model.creditRules.map((rule) => (
              <li
                key={rule.category}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-4 py-3 text-body-md"
              >
                <span className="text-on-surface">{CATEGORY_LABELS[rule.category]}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="tabular-nums text-on-surface-variant">
                    ไม่น้อยกว่า {rule.minCredits} หน่วยกิต
                  </span>
                  {editable && (
                    <>
                      <button
                        type="button"
                        onClick={() => open({ kind: "rule", rule })}
                        aria-label={`แก้ไขเกณฑ์ ${CATEGORY_LABELS[rule.category]}`}
                        className={iconButtonClass}
                      >
                        <EditIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          open({
                            kind: "confirm",
                            title: "ลบเกณฑ์หน่วยกิต",
                            confirmLabel: "ลบเกณฑ์",
                            message: `ลบเกณฑ์หน่วยกิตของ "${CATEGORY_LABELS[rule.category]}"?`,
                            run: () => deleteCreditRule(code, rule.category),
                          })
                        }
                        aria-label={`ลบเกณฑ์ ${CATEGORY_LABELS[rule.category]}`}
                        className={iconDangerButtonClass}
                      >
                        <DeleteIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-headline-md text-on-surface">กลุ่มวิชาและรายวิชา</h3>
        {editable && (
          <AddButton label="เพิ่มกลุ่มวิชา" onClick={() => open({ kind: "group", group: null })} />
        )}
      </div>

      {groups.length === 0 && ungrouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest">
          <EmptyState
            Icon={MenuBookIcon}
            title="หลักสูตรนี้ยังไม่มีโครงสร้าง"
            description={
              editable
                ? "เริ่มจากเพิ่มกลุ่มวิชา แล้วเพิ่มรายวิชาในแต่ละกลุ่ม"
                : "ผู้ดูแลระบบยังไม่ได้กรอกโครงสร้างของหลักสูตรนี้"
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const courses = model.courses
              .filter((c) => c.groupKey === group.key)
              .sort((a, b) => a.courseCode.localeCompare(b.courseCode));
            return (
              <section key={group.key} className={cardClass}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant/40 px-6 py-4">
                  <div className="min-w-0">
                    <p className="text-caption text-on-surface-variant">
                      {group.parentNameTh || CATEGORY_LABELS[group.category]} · {CATEGORY_LABELS[group.category]}
                    </p>
                    <h4 className="text-label-md text-on-surface">{group.nameTh}</h4>
                    <p className="text-label-sm text-on-surface-variant">
                      {group.listedCredits !== null ? `${group.listedCredits} หน่วยกิต · ` : ""}
                      {courses.length} วิชา
                    </p>
                  </div>
                  {editable && (
                    <div className="flex flex-wrap items-center gap-1">
                      <AddButton
                        label="เพิ่มรายวิชา"
                        compact
                        onClick={() => open({ kind: "course", course: null, preset: { groupKey: group.key } })}
                      />
                      <button
                        type="button"
                        onClick={() => open({ kind: "group", group })}
                        aria-label={`แก้ไขกลุ่ม ${group.nameTh}`}
                        className={iconButtonClass}
                      >
                        <EditIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          open({
                            kind: "confirm",
                            title: "ลบกลุ่มวิชา",
                            confirmLabel: "ลบกลุ่มวิชา",
                            message: (
                              <>
                                ลบกลุ่ม <strong className="text-on-surface">&ldquo;{group.nameTh}&rdquo;</strong>?
                                ลบได้เฉพาะกลุ่มที่ไม่มีรายวิชาและช่องวิชาเลือกในแผนผูกอยู่
                              </>
                            ),
                            run: () => deleteGroup(code, group.key),
                          })
                        }
                        aria-label={`ลบกลุ่ม ${group.nameTh}`}
                        className={iconDangerButtonClass}
                      >
                        <DeleteIcon className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
                <CourseList
                  courses={courses}
                  empty="ยังไม่มีรายวิชาในกลุ่มนี้"
                  editable={editable}
                  onEdit={(course) => open({ kind: "course", course })}
                  onRemove={confirmRemoveCourse}
                  removeLabel="ลบออกจากหลักสูตร"
                />
              </section>
            );
          })}

          {(ungrouped.length > 0 || editable) && (
            <section className={cardClass}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant/40 px-6 py-4">
                <div>
                  <h4 className="text-label-md text-on-surface">รายวิชาที่ไม่อยู่ในกลุ่ม</h4>
                  <p className="text-label-sm text-on-surface-variant">
                    เช่น สหกิจศึกษา หรือวิชาที่ให้เลือกเรียนหนึ่งวิชาในภาคเดียวกัน
                  </p>
                </div>
                {editable && (
                  <AddButton
                    label="เพิ่มรายวิชา"
                    compact
                    onClick={() => open({ kind: "course", course: null, preset: { groupKey: null } })}
                  />
                )}
              </div>
              <CourseList
                courses={ungrouped}
                empty="ไม่มีรายวิชานอกกลุ่ม"
                editable={editable}
                onEdit={(course) => open({ kind: "course", course })}
                onRemove={confirmRemoveCourse}
                removeLabel="ลบออกจากหลักสูตร"
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Study plan                                                          */
/* ------------------------------------------------------------------ */

function PlanTab({
  code,
  model,
  actions,
}: {
  code: string;
  model: CurriculumModel;
  actions: ViewActions;
}) {
  const { editable, open } = actions;
  const terms = planTerms(model);
  const years = [...new Set(terms.map((t) => t.year))];
  const total = terms.reduce((sum, t) => sum + t.totalCredits, 0);
  const hasAny = terms.some((t) => t.courses.length > 0 || t.slots.length > 0);

  if (!hasAny && !editable) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest">
        <EmptyState
          Icon={MenuBookIcon}
          title="หลักสูตรนี้ยังไม่มีแผนการศึกษา"
          description="ผู้ดูแลระบบยังไม่ได้กำหนดรายวิชาในแต่ละภาคเรียนของหลักสูตรนี้"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-label-md text-on-surface-variant">
        รวมตลอดแผน <span className="tabular-nums">{total}</span> หน่วยกิต
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {years.map((year) => (
          <article key={year} className={`${cardClass} p-5`}>
            <h3 className="mb-3 font-display text-label-md font-bold text-on-surface">ชั้นปีที่ {year}</h3>
            <div className="space-y-5">
              {terms
                .filter((t) => t.year === year)
                .map((term) => (
                  <section key={term.semester} aria-label={`ชั้นปีที่ ${year} ${SEMESTER_LABEL[term.semester]}`}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-label-sm text-primary-container">
                      <span>{SEMESTER_LABEL[term.semester] ?? `ภาคเรียนที่ ${term.semester}`}</span>
                      <span className="tabular-nums">{term.totalCredits} หน่วยกิต</span>
                    </div>
                    <ul className="divide-y divide-outline-variant/30">
                      {term.courses.map((course) => (
                        <li key={course.courseCode} className="flex items-start justify-between gap-3 py-2">
                          <CourseText course={course} />
                          <span className="flex shrink-0 items-center gap-1">
                            <Credits course={course} />
                            {editable && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => open({ kind: "course", course })}
                                  aria-label={`แก้ไข ${course.courseCode}`}
                                  className={iconButtonClass}
                                >
                                  <EditIcon className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={actions.pending}
                                  onClick={() => actions.removeFromPlan(course)}
                                  aria-label={`เอา ${course.courseCode} ออกจากแผน`}
                                  className={iconDangerButtonClass}
                                >
                                  <DeleteIcon className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </span>
                        </li>
                      ))}
                      {term.slots.map((slot) => (
                        <li key={slot.key} className="flex items-start justify-between gap-3 py-2 text-body-md">
                          <span className="min-w-0 text-on-surface-variant">
                            {slot.label}
                            {slot.slotCount > 1 ? ` × ${slot.slotCount}` : ""}
                            {slot.note && <span className="block text-caption">{slot.note}</span>}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            <span className="text-label-sm tabular-nums text-on-surface-variant">
                              {slot.creditsPerSlot * slot.slotCount} หน่วยกิต
                            </span>
                            {editable && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => open({ kind: "slot", slot })}
                                  aria-label={`แก้ไขช่อง ${slot.label}`}
                                  className={iconButtonClass}
                                >
                                  <EditIcon className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    open({
                                      kind: "confirm",
                                      title: "ลบช่องวิชาเลือก",
                                      confirmLabel: "ลบช่อง",
                                      message: `ลบช่อง "${slot.label}" ของชั้นปีที่ ${year} ${SEMESTER_LABEL[term.semester]}?`,
                                      run: () => deleteSlot(code, slot.key),
                                    })
                                  }
                                  aria-label={`ลบช่อง ${slot.label}`}
                                  className={iconDangerButtonClass}
                                >
                                  <DeleteIcon className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </span>
                        </li>
                      ))}
                      {term.courses.length === 0 && term.slots.length === 0 && (
                        <li className="py-2 text-body-md text-on-surface-variant">ยังไม่มีรายวิชาในภาคนี้</li>
                      )}
                    </ul>
                    {editable && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <AddButton
                          label="เพิ่มรายวิชา"
                          compact
                          onClick={() =>
                            open({
                              kind: "course",
                              course: null,
                              preset: { year: term.year, semester: term.semester },
                            })
                          }
                        />
                        <AddButton
                          label="เพิ่มช่องวิชาเลือก"
                          compact
                          onClick={() =>
                            open({
                              kind: "slot",
                              slot: null,
                              preset: { year: term.year, semester: term.semester },
                            })
                          }
                        />
                      </div>
                    )}
                  </section>
                ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/40 px-6 py-4">
      <h3 className="font-display text-headline-md text-on-surface">{title}</h3>
      {action}
    </div>
  );
}

function AddButton({
  label,
  onClick,
  compact = false,
}: {
  label: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        compact
          ? "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-label-sm text-primary-container transition-colors hover:bg-primary-container/10"
          : `${secondaryButtonClass} inline-flex items-center gap-2`
      }
    >
      <AddIcon className="h-4 w-4" />
      {label}
    </button>
  );
}

function CourseText({ course }: { course: PlanCourse }) {
  return (
    <span className="min-w-0">
      <span className="block text-caption tabular-nums text-on-surface-variant">{course.courseCode}</span>
      <span className="block text-body-md text-on-surface">{course.nameTh}</span>
      {(course.choiceGroup || !course.isCountedInPlan || course.planNote) && (
        <span className="block text-caption text-on-surface-variant">
          {[
            course.choiceGroup ? `เลือก 1 วิชาในกลุ่ม ${course.choiceGroup}` : null,
            course.isCountedInPlan ? null : "ไม่นับหน่วยกิตในแผน",
            course.planNote,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
    </span>
  );
}

function Credits({ course }: { course: PlanCourse }) {
  return (
    <span className="text-label-sm tabular-nums text-on-surface-variant">
      {course.creditPattern ?? `${course.credits} หน่วยกิต`}
    </span>
  );
}

function CourseList({
  courses,
  empty,
  editable,
  onEdit,
  onRemove,
  removeLabel,
}: {
  courses: PlanCourse[];
  empty: string;
  editable: boolean;
  onEdit: (course: PlanCourse) => void;
  onRemove: (course: PlanCourse) => void;
  removeLabel: string;
}) {
  if (courses.length === 0) {
    return <p className="px-6 py-4 text-body-md text-on-surface-variant">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-outline-variant/30 px-6">
      {courses.map((course) => (
        <li key={course.courseCode} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <CourseText course={course} />
          <span className="flex shrink-0 flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-label-sm ${
                course.isRequired
                  ? "bg-primary-container/10 text-primary-container"
                  : "bg-surface-variant text-on-surface-variant"
              }`}
            >
              {course.isRequired ? "บังคับ" : "เลือก"}
            </span>
            {course.recommendedYear && course.recommendedSemester && (
              <span className="text-label-sm text-on-surface-variant">
                ปี {course.recommendedYear} · {SEMESTER_LABEL[course.recommendedSemester]}
              </span>
            )}
            <Credits course={course} />
            {editable && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(course)}
                  aria-label={`แก้ไข ${course.courseCode}`}
                  className={iconButtonClass}
                >
                  <EditIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(course)}
                  aria-label={`${removeLabel} ${course.courseCode}`}
                  className={iconDangerButtonClass}
                >
                  <DeleteIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ConfirmDialog({
  dialog,
  onClose,
  onDone,
}: {
  dialog: Extract<Dialog, { kind: "confirm" }>;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const result = await dialog.run();
      if (!result.ok) return setError(result.error);
      onDone(`${dialog.confirmLabel}แล้ว`);
    });

  return (
    <Modal title={dialog.title} onClose={onClose}>
      <p className="text-body-md text-on-surface-variant">{dialog.message}</p>
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={secondaryButtonClass}>
          ยกเลิก
        </button>
        <button type="button" onClick={confirm} disabled={pending} className={dangerButtonClass}>
          {pending ? "กำลังลบ..." : dialog.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
