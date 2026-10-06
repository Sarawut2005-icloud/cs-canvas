"use client";

import Link from "next/link";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { AddIcon, EditIcon } from "../../components/icons";
import type { ReferenceDataset, ReferenceItem, RoomType } from "../../lib/api";
import { formatDate, formatNumber } from "../../lib/format";
import Modal from "../_components/Modal";
import {
  cardClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  tdClass,
  thClass,
} from "../_components/ui";
import {
  createReference,
  setCurrentTerm,
  updateReference,
  type ReferenceBody,
} from "./actions";
import {
  DEFINITIONS,
  optionsFor,
  ROOM_TYPE_LABELS,
  type Column,
  type Field,
  type SelectOptions,
} from "./datasets";

/** A row as the API sends it — dataset-specific keys on top of the shared ones. */
export type ReferenceRow = ReferenceItem & Record<string, unknown>;

function read(row: ReferenceRow, column: Column): unknown {
  if (!column.path) return row[column.key];
  return column.path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      row,
    );
}

function Cell({ row, column }: { row: ReferenceRow; column: Column }) {
  const value = read(row, column);
  switch (column.format) {
    case "number":
      return <>{typeof value === "number" ? formatNumber(value) : "—"}</>;
    case "date":
      return <>{typeof value === "string" && value ? formatDate(value) : "—"}</>;
    case "roomType":
      return <>{ROOM_TYPE_LABELS[value as RoomType] ?? String(value ?? "—")}</>;
    case "current":
      return value ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary-container">
          <span className="h-2 w-2 rounded-full bg-primary-container" />
          ภาคปัจจุบัน
        </span>
      ) : (
        <span className="text-on-surface-variant">—</span>
      );
    case "coords": {
      const lat = row.latitude;
      const lng = row.longitude;
      return typeof lat === "number" && typeof lng === "number" ? (
        <span className="tabular-nums">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </span>
      ) : (
        <>—</>
      );
    }
    default:
      return <>{value === null || value === undefined || value === "" ? "—" : String(value)}</>;
  }
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-label-sm ${
        active
          ? "bg-success/10 text-emerald-700"
          : "bg-surface-variant text-on-surface-variant"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${active ? "bg-success" : "bg-outline"}`} />
      {active ? "ใช้งาน" : "ปิดใช้งาน"}
    </span>
  );
}

type Editing = { mode: "create" } | { mode: "edit"; row: ReferenceRow };

/**
 * One dataset's table plus, for admins, the add/edit form and the
 * enable/disable switch. The list itself is server-rendered data — after a
 * write the page is refreshed so the table shows what the API stored.
 */
export default function ReferenceTable({
  dataset,
  rows,
  options,
  canManage,
  showingInactive,
  showInactiveHref,
  footer,
}: {
  dataset: ReferenceDataset;
  rows: ReferenceRow[];
  options: SelectOptions;
  canManage: boolean;
  /** Whether the current list already includes disabled rows. */
  showingInactive: boolean;
  /** Same list with "แสดงที่ปิดใช้งาน" on — offered after a row is disabled. */
  showInactiveHref: string;
  /** The pager, rendered inside the card under the table. */
  footer?: ReactNode;
}) {
  const def = DEFINITIONS[dataset];
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [toggling, setToggling] = useState<ReferenceRow | null>(null);
  const [current, setCurrent] = useState<ReferenceRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ReactNode>(null);
  const [pending, startTransition] = useTransition();

  const done = () => {
    setEditing(null);
    setToggling(null);
    setCurrent(null);
    setError(null);
    router.refresh();
  };

  const toggle = (row: ReferenceRow) =>
    startTransition(async () => {
      const result = await updateReference(dataset, row.code, {
        isActive: !row.isActive,
      });
      if (!result.ok) return setError(result.error);
      // A row that was just disabled drops out of the default list — say
      // where it went instead of letting it silently vanish.
      setNotice(
        row.isActive && !showingInactive ? (
          <>
            ปิดใช้งาน <strong className="text-on-surface">{row.code}</strong> แล้ว
            — รายการ &ldquo;ใช้งานอยู่&rdquo; จะไม่แสดง{def.singular}นี้แล้ว{" "}
            <Link href={showInactiveHref} className="text-primary-container underline">
              ดูที่ปิดใช้งานแล้ว
            </Link>{" "}
            เพื่อเปิดใช้งานอีกครั้ง
          </>
        ) : (
          <>
            {row.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}{" "}
            <strong className="text-on-surface">{row.code}</strong> แล้ว
          </>
        ),
      );
      done();
    });

  const makeCurrent = (row: ReferenceRow) =>
    startTransition(async () => {
      const result = await setCurrentTerm(row.code);
      if (!result.ok) return setError(result.error);
      done();
    });

  const columnCount = def.columns.length + 2 + (canManage ? 1 : 0);

  return (
    <>
      <div className={`fade-slide-up stagger-2 ${cardClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/40 px-6 py-4">
          <p className="text-label-md text-on-surface-variant">
            {canManage
              ? "แก้ไขได้ · ไม่มีการลบ — ใช้ปิดใช้งานแทน"
              : "อ่านอย่างเดียว · เฉพาะผู้ดูแลระบบแก้ไขได้"}
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setEditing({ mode: "create" })}
              className={primaryButtonClass}
            >
              <AddIcon className="h-4 w-4" />
              เพิ่ม{def.singular}
            </button>
          )}
        </div>

        {error && !editing && (
          <p role="alert" className="mx-6 mt-4 rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
            {error}
          </p>
        )}

        {notice && !error && (
          <p role="status" className="mx-6 mt-4 rounded-lg bg-primary-container/10 px-4 py-3 text-label-md text-on-surface-variant">
            {notice}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                {def.columns.map((column) => (
                  <th key={column.key} className={thClass}>
                    {column.label}
                  </th>
                ))}
                <th className={thClass}>สถานะ</th>
                <th className={thClass}>แก้ไขล่าสุด</th>
                {canManage && <th className={`${thClass} text-right`}>จัดการ</th>}
              </tr>
            </thead>
            <tbody className="text-body-md">
              {rows.map((row) => (
                <tr
                  key={row.code}
                  className={`border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-surface/50 ${
                    row.isActive ? "" : "text-on-surface-variant"
                  }`}
                >
                  {def.columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={`${tdClass} ${index === 0 ? "whitespace-nowrap font-medium text-on-surface" : ""}`}
                    >
                      {dataset === "curricula" && column.key === "code" ? (
                        <Link
                          href={`/backoffice/reference/curricula/${encodeURIComponent(row.code)}`}
                          className="tabular-nums text-primary-container hover:underline"
                        >
                          {row.code}
                        </Link>
                      ) : (
                        <Cell row={row} column={column} />
                      )}
                    </td>
                  ))}
                  <td className={tdClass}>
                    <ActiveBadge active={row.isActive} />
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-on-surface-variant`}>
                    {formatDate(row.updatedAt)}
                  </td>
                  {canManage && (
                    <td className={`${tdClass} whitespace-nowrap text-right`}>
                      <div className="inline-flex items-center gap-1">
                        {dataset === "academic-terms" && !row.isCurrent && row.isActive && (
                          <button
                            type="button"
                            onClick={() => setCurrent(row)}
                            className="rounded-lg px-2 py-1 text-label-sm text-primary-container transition-colors hover:bg-primary-container/10"
                          >
                            ตั้งเป็นปัจจุบัน
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditing({ mode: "edit", row })}
                          aria-label={`แก้ไข ${row.code}`}
                          className="p-1.5 text-outline transition-colors hover:text-primary-container"
                        >
                          <EditIcon className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setToggling(row)}
                          className={`rounded-lg px-2 py-1 text-label-sm transition-colors ${
                            row.isActive
                              ? "text-on-surface-variant hover:bg-error/5 hover:text-error"
                              : "text-emerald-700 hover:bg-success/10"
                          }`}
                        >
                          {row.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="px-6 py-12 text-center text-on-surface-variant">
                    ไม่พบ{def.singular}ที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {footer}
      </div>

      {editing && (
        <Modal
          title={editing.mode === "create" ? `เพิ่ม${def.singular}` : `แก้ไข${def.singular} ${editing.row.code}`}
          onClose={() => setEditing(null)}
        >
          <ReferenceForm
            dataset={dataset}
            fields={def.fields}
            options={options}
            initial={editing.mode === "edit" ? editing.row : undefined}
            onDone={done}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {toggling && (
        <Modal
          title={toggling.isActive ? `ปิดใช้งาน${def.singular}` : `เปิดใช้งาน${def.singular}`}
          onClose={() => setToggling(null)}
        >
          <p className="text-body-md text-on-surface-variant">
            {toggling.isActive ? (
              <>
                <strong className="text-on-surface">{toggling.code}</strong> จะไม่แสดงในรายการปกติ
                แต่ข้อมูลยังอยู่และเปิดกลับมาใช้ได้ทุกเมื่อ
              </>
            ) : (
              <>
                เปิดใช้งาน <strong className="text-on-surface">{toggling.code}</strong> อีกครั้ง
              </>
            )}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setToggling(null)} className={secondaryButtonClass}>
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => toggle(toggling)}
              disabled={pending}
              className={primaryButtonClass}
            >
              {toggling.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </button>
          </div>
        </Modal>
      )}

      {current && (
        <Modal title="ตั้งเป็นภาคการศึกษาปัจจุบัน" onClose={() => setCurrent(null)}>
          <p className="text-body-md text-on-surface-variant">
            ภาค <strong className="text-on-surface">{current.code}</strong> จะกลายเป็นภาคปัจจุบัน
            และภาคเดิมจะถูกยกเลิกอัตโนมัติ ระบบย่อยทุกตัวที่ถาม “ภาคปัจจุบัน” จะได้ค่านี้ทันที
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setCurrent(null)} className={secondaryButtonClass}>
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => makeCurrent(current)}
              disabled={pending}
              className={primaryButtonClass}
            >
              ยืนยัน
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Schema-driven form                                                    */
/* ------------------------------------------------------------------ */

function initialValues(fields: Field[], row?: ReferenceRow): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => {
      const value = row?.[field.key];
      return [field.key, value === null || value === undefined ? "" : String(value)];
    }),
  );
}

/** Turns the form's strings into the JSON body the DTO expects. */
function toBody(fields: Field[], values: Record<string, string>): ReferenceBody {
  const body: ReferenceBody = {};
  for (const field of fields) {
    const raw = values[field.key].trim();
    if (raw === "") continue; // optional and blank — leave the stored value alone
    body[field.key] = field.type === "number" ? Number(raw) : raw;
  }
  return body;
}

function validate(fields: Field[], values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const raw = values[field.key].trim();
    if (!raw) {
      if (field.required) errors[field.key] = `กรุณากรอก${field.label}`;
      continue;
    }
    if (field.pattern && !field.pattern.test(raw)) {
      errors[field.key] = field.patternMessage ?? `${field.label}ไม่ถูกต้อง`;
    } else if (field.type === "number") {
      const n = Number(raw);
      if (Number.isNaN(n)) errors[field.key] = `${field.label}ต้องเป็นตัวเลข`;
      else if (!field.decimals && !Number.isInteger(n))
        errors[field.key] = `${field.label}ต้องเป็นจำนวนเต็ม`;
    }
  }
  return errors;
}

function ReferenceForm({
  dataset,
  fields,
  options,
  initial,
  onDone,
  onCancel,
}: {
  dataset: ReferenceDataset;
  fields: Field[];
  options: SelectOptions;
  initial?: ReferenceRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = Boolean(initial);
  // On edit the create-only fields are shown as text, never sent (D5).
  const editable = fields.filter((field) => !(editing && field.createOnly));
  const [values, setValues] = useState(() => initialValues(fields, initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const found = validate(editable, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const body = toBody(editable, values);
    startTransition(async () => {
      const result = initial
        ? await updateReference(dataset, initial.code, body)
        : await createReference(dataset, body);
      if (!result.ok) return setFormError(result.error);
      onDone();
    });
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      {editing &&
        fields
          .filter((field) => field.createOnly)
          .map((field) => (
            <div key={field.key} className="space-y-1">
              <span className="block text-label-md text-on-surface">{field.label}</span>
              <p className="rounded-lg bg-surface-variant/60 px-3 py-2 text-body-md text-on-surface-variant">
                {initial?.[field.key] === undefined || initial?.[field.key] === null
                  ? "—"
                  : String(initial[field.key])}
              </p>
            </div>
          ))}

      {editable.map((field) => {
        const id = `ref-${field.key}`;
        const error = errors[field.key];
        const common = {
          id,
          value: values[field.key],
          "aria-invalid": Boolean(error),
          "aria-describedby": error ? `${id}-error` : field.hint ? `${id}-hint` : undefined,
          className: `${inputClass} ${error ? "input-error" : ""}`,
        };
        return (
          <div key={field.key} className="space-y-1.5">
            <label htmlFor={id} className="block text-label-md text-on-surface">
              {field.label}
              {field.required && <span aria-hidden className="text-error"> *</span>}
            </label>
            {field.type === "select" ? (
              <select {...common} onChange={(event) => set(field.key, event.target.value)}>
                <option value="">{field.required ? "— เลือก —" : "— ไม่ระบุ —"}</option>
                {optionsFor(field.select, options).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...common}
                type={field.type === "number" ? "text" : field.type}
                inputMode={field.type === "number" ? (field.decimals ? "decimal" : "numeric") : undefined}
                placeholder={field.placeholder}
                onChange={(event) => set(field.key, event.target.value)}
              />
            )}
            {error ? (
              <p id={`${id}-error`} className="text-label-sm text-error">
                {error}
              </p>
            ) : (
              field.hint && (
                <p id={`${id}-hint`} className="text-label-sm text-on-surface-variant">
                  {field.hint}
                </p>
              )
            )}
          </div>
        );
      })}

      {formError && (
        <p role="alert" className="rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`relative ${primaryButtonClass} ${pending ? "btn-loading" : ""}`}
        >
          <span className="btn-text">{editing ? "บันทึก" : "เพิ่ม"}</span>
          <span className="dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>
    </form>
  );
}
