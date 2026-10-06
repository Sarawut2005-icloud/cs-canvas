"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import type { Subsystem, SubsystemCategory } from "../../../lib/api";
import type { UserRole } from "../../../lib/session";
import {
  CORE_ROLES,
  NAME_PATTERN,
  SUBSYSTEM_CATEGORIES,
  baseUrlProblem,
  callbackUrlProblem,
  standardsVersionLabel,
} from "../../../lib/subsystems";
import {
  createSubsystem,
  updateSubsystem,
  type SubsystemInput,
} from "../actions";
import { AddIcon, DeleteIcon } from "../../../components/icons";
import {
  cardClass,
  iconDangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../../_components/ui";

type Field = "name" | "displayName" | "category" | "description" | "repo" | "callbackUrl" | "baseUrl" | "roles";

/** Longest description the API accepts. */
const DESCRIPTION_MAX = 200;

type ExceptionRow = { key: number; username: string; role: UserRole; reason: string };

type Values = {
  name: string;
  displayName: string;
  /** "" until a new registration picks one. */
  category: SubsystemCategory | "";
  description: string;
  listedInMenu: boolean;
  /** A new registration must describe itself; older entries may lack one. */
  requireDescription: boolean;
  repo: string;
  standardsVersion: string;
  callbackUrl: string;
  baseUrl: string;
  roles: Record<UserRole, { allowed: boolean; mapped: string }>;
};

function initialValues(subsystem: Subsystem | undefined, latest: string): Values {
  const mapping = subsystem?.defaultRoleMapping ?? {};
  return {
    name: subsystem?.name ?? "",
    displayName: subsystem?.displayName ?? "",
    category: subsystem?.category ?? "",
    description: subsystem?.description ?? "",
    listedInMenu: subsystem?.listedInMenu ?? true,
    requireDescription: !subsystem,
    repo: subsystem?.repo ?? "",
    standardsVersion: subsystem?.standardsVersion ?? latest,
    callbackUrl: subsystem?.callbackUrl ?? "",
    baseUrl: subsystem?.baseUrl ?? "",
    roles: Object.fromEntries(
      CORE_ROLES.map(({ role, suggested }) => [
        role,
        role in mapping
          ? { allowed: true, mapped: mapping[role] }
          : // Nothing is pre-selected: who may enter is a deliberate choice.
            { allowed: false, mapped: suggested },
      ]),
    ) as Values["roles"],
  };
}

function validate(values: Values, field: Field): string | null {
  switch (field) {
    case "name":
      if (!values.name.trim()) return "กรุณากรอกชื่อระบบ";
      return NAME_PATTERN.test(values.name.trim())
        ? null
        : "ชื่อระบบใช้ได้เฉพาะ a-z ตัวพิมพ์เล็ก ตัวเลข และขีดกลาง (-) คั่นระหว่างคำ ไม่เกิน 64 ตัว";
    case "displayName":
      return values.displayName.trim() ? null : "กรุณากรอกชื่อที่แสดง";
    case "category":
      return values.category ? null : "กรุณาเลือกหมวดหมู่ของระบบ";
    case "description": {
      const text = values.description.trim();
      if (!text) return values.requireDescription ? "กรุณาอธิบายสั้นๆ ว่าระบบนี้ใช้ทำอะไร" : null;
      return text.length > DESCRIPTION_MAX ? `คำอธิบายยาวได้ไม่เกิน ${DESCRIPTION_MAX} ตัวอักษร` : null;
    }
    case "repo":
      return values.repo.trim() ? null : "กรุณากรอกชื่อ repository";
    case "callbackUrl":
      return values.callbackUrl.trim()
        ? callbackUrlProblem(values.callbackUrl)
        : "กรุณากรอก callback URL";
    case "baseUrl":
      // Optional: only a non-empty value has to be a registrable URL.
      return values.baseUrl.trim() ? baseUrlProblem(values.baseUrl) : null;
    case "roles": {
      const allowed = Object.values(values.roles).filter((r) => r.allowed);
      if (allowed.length === 0) return "เลือกบทบาทที่เข้าระบบนี้ได้อย่างน้อย 1 บทบาท";
      if (allowed.some((r) => !r.mapped.trim()))
        return "กรอกชื่อบทบาทในระบบย่อยให้ครบทุกบทบาทที่เลือก";
      return null;
    }
  }
}

const FIELDS: Field[] = ["name", "displayName", "category", "description", "repo", "callbackUrl", "baseUrl", "roles"];

function mappingOf(values: Values): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values.roles)
      .filter(([, r]) => r.allowed)
      .map(([role, r]) => [role, r.mapped.trim()]),
  );
}

export default function SubsystemForm({
  subsystem,
  lockReviewedFields = false,
  standardsVersions,
  renameWarning = false,
  canSetListing = false,
}: {
  /** Omit to register a new subsystem. */
  subsystem?: Subsystem;
  /**
   * The owner of an approved subsystem: name, callback URL, base URL and the
   * role mapping go through a change request instead (or an admin, for name).
   */
  lockReviewedFields?: boolean;
  /** Released csmju2030-standards versions, newest first (from the API). */
  standardsVersions: string[];
  /** An admin editing an approved subsystem: renaming changes the token azp. */
  renameWarning?: boolean;
  /** Admins decide whether users see the subsystem in their menu. */
  canSetListing?: boolean;
}) {
  const router = useRouter();
  const editing = Boolean(subsystem);
  // A stored version no longer in the list (e.g. 1.0) stays selectable so
  // saving the other fields does not force a change.
  const versionOptions =
    subsystem && !standardsVersions.includes(subsystem.standardsVersion)
      ? [...standardsVersions, subsystem.standardsVersion]
      : standardsVersions;
  const [values, setValues] = useState(() =>
    initialValues(subsystem, standardsVersions[0] ?? ""),
  );
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pending, startTransition] = useTransition();
  const refs = useRef<Partial<Record<Field, HTMLElement | null>>>({});
  const nextKey = useRef(0);

  const locked = (field: Field) =>
    lockReviewedFields && ["name", "callbackUrl", "baseUrl", "roles"].includes(field);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const check = (field: Field, next = values) =>
    setErrors((prev) => ({ ...prev, [field]: validate(next, field) ?? undefined }));

  const setRole = (role: UserRole, patch: Partial<Values["roles"][UserRole]>) => {
    const next = {
      ...values,
      roles: { ...values.roles, [role]: { ...values.roles[role], ...patch } },
    };
    setValues(next);
    if (errors.roles) check("roles", next);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const found = Object.fromEntries(
      FIELDS.filter((f) => !locked(f)).map((f) => [f, validate(values, f) ?? undefined]),
    ) as Partial<Record<Field, string>>;
    const failing = FIELDS.filter((f) => found[f]);
    const allowedRoles = Object.keys(mappingOf(values));
    const badException = exceptions.find(
      (row) => !row.username.trim() || !row.reason.trim() || !allowedRoles.includes(row.role),
    );

    setErrors(found);
    if (failing.length > 0 || badException) {
      setAnnouncement(`พบข้อมูลที่ต้องแก้ไข ${failing.length + (badException ? 1 : 0)} รายการ`);
      if (failing[0]) {
        refs.current[failing[0]]?.scrollIntoView({ block: "center" });
        refs.current[failing[0]]?.focus();
      } else {
        setFormError(
          "กรอกชื่อผู้ใช้และเหตุผลของคำขอสิทธิ์พิเศษให้ครบ เลือกบทบาทที่อยู่ในรายการบทบาทที่เข้าระบบได้ หรือลบแถวที่ไม่ใช้",
        );
      }
      return;
    }

    const baseUrl = values.baseUrl.trim();
    const input: SubsystemInput = {
      name: values.name.trim(),
      displayName: values.displayName.trim(),
      // validate() has made sure a category was chosen.
      category: values.category || undefined,
      description: values.description.trim(),
      ...(canSetListing ? { listedInMenu: values.listedInMenu } : {}),
      repo: values.repo.trim(),
      standardsVersion: values.standardsVersion,
      callbackUrl: values.callbackUrl.trim(),
      // On edit an empty string clears the stored value; on create it is omitted.
      ...(subsystem || baseUrl ? { baseUrl } : {}),
      defaultRoleMapping: mappingOf(values),
    };

    startTransition(async () => {
      if (subsystem) {
        const { name, callbackUrl, baseUrl, defaultRoleMapping, ...editable } = input;
        const result = await updateSubsystem(
          subsystem.id,
          lockReviewedFields
            ? editable
            : { ...editable, name, callbackUrl, baseUrl, defaultRoleMapping },
        );
        if (!result.ok) return setFormError(result.error);
        router.push(`/backoffice/subsystems/${encodeURIComponent(subsystem.id)}`);
        router.refresh();
      } else {
        const result = await createSubsystem({
          ...input,
          requestedExceptions: exceptions.map(({ username, role, reason }) => ({
            username: username.trim(),
            role,
            reason: reason.trim(),
          })),
        });
        if (!result.ok) return setFormError(result.error);
        router.push(`/backoffice/subsystems/${encodeURIComponent(result.data.id)}`);
      }
    });
  };

  // Approved: the owner asks for these through a change request (handoff 2.2);
  // only an administrator renames a subsystem (2.3).
  const lockNote = "ระบบนี้อนุมัติแล้ว — แก้ช่องนี้ด้วยปุ่ม \"ขอแก้ไข\" ในหน้ารายละเอียด เพื่อให้ผู้ดูแลระบบอนุมัติ";
  const nameLockNote = "เปลี่ยนชื่อระบบได้เฉพาะผู้ดูแลระบบ (ชื่อระบบคือ azp ใน token)";

  return (
    <form noValidate onSubmit={submit} className="fade-slide-up stagger-1 space-y-6">
      <p className="text-label-md text-on-surface-variant">
        ช่องที่มี <span className="text-error">*</span> จำเป็นต้องกรอก
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <fieldset className={`${cardClass} space-y-4 p-6`}>
        <legend className="sr-only">ข้อมูลระบบย่อย</legend>
        <h3 className="font-display text-headline-md text-on-surface">ข้อมูลระบบ</h3>

        <TextField
          id="name"
          label="ชื่อระบบ"
          hint="ต้องตรงกับ name ใน subsystem.yaml เช่น equipment-service"
          value={values.name}
          error={errors.name}
          disabledReason={locked("name") ? nameLockNote : undefined}
          inputRef={(el) => (refs.current.name = el)}
          onChange={(v) => set("name", v)}
          onBlur={() => check("name")}
        />
        {renameWarning && values.name.trim() !== subsystem?.name && (
          <p role="note" className="rounded-lg bg-warning/10 px-4 py-3 text-label-md text-on-surface">
            เปลี่ยนชื่อระบบ = เปลี่ยน azp ใน token ทุกใบ — ทีมต้องแก้ SUBSYSTEM_ID ของระบบย่อยพร้อมกัน
            ไม่งั้นระบบย่อยจะปฏิเสธ token หลังบันทึก
          </p>
        )}
        <TextField
          id="displayName"
          label="ชื่อที่แสดง"
          hint="ชื่อที่ผู้ใช้เห็นในเมนูระบบย่อย เช่น ระบบครุภัณฑ์"
          value={values.displayName}
          error={errors.displayName}
          inputRef={(el) => (refs.current.displayName = el)}
          onChange={(v) => set("displayName", v)}
          onBlur={() => check("displayName")}
        />
        <div className="space-y-2">
          <label htmlFor="category" className="block text-label-md text-on-surface">
            หมวดหมู่<span aria-hidden className="text-error"> *</span>
          </label>
          <select
            id="category"
            ref={(el) => {
              refs.current.category = el;
            }}
            value={values.category}
            onChange={(event) => {
              const next = { ...values, category: event.target.value as SubsystemCategory | "" };
              setValues(next);
              check("category", next);
            }}
            aria-required
            aria-invalid={Boolean(errors.category)}
            aria-describedby="category-hint"
            className={inputClass}
          >
            {values.category === "" && <option value="">— เลือกหมวดหมู่ —</option>}
            {SUBSYSTEM_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {errors.category ? (
            <p id="category-hint" className="text-label-sm text-error">
              {errors.category}
            </p>
          ) : (
            <p id="category-hint" className="text-label-sm text-on-surface-variant">
              {values.category
                ? SUBSYSTEM_CATEGORIES.find((c) => c.value === values.category)?.hint
                : "เลือกหมวดที่ตรงกับงานของระบบ"}
              {" · ใช้จัดกลุ่มในเมนูระบบย่อยของผู้ใช้"}
            </p>
          )}
        </div>
        <TextField
          id="description"
          label="คำอธิบายสั้นๆ"
          optional={!values.requireDescription}
          hint={`1 บรรทัด บอกผู้ใช้ว่าระบบนี้ใช้ทำอะไร · แสดงใต้ชื่อระบบในเมนูและหน้า “ระบบย่อยทั้งหมด” · ไม่เกิน ${DESCRIPTION_MAX} ตัวอักษร`}
          placeholder="เช่น ยืม-คืนครุภัณฑ์ของสาขาวิชา"
          value={values.description}
          error={errors.description}
          inputRef={(el) => (refs.current.description = el)}
          onChange={(v) => set("description", v)}
          onBlur={() => check("description")}
        />
        {canSetListing && (
          <label className="flex items-start gap-3 rounded-lg bg-surface-container-low p-3">
            <input
              type="checkbox"
              checked={values.listedInMenu}
              onChange={(event) => setValues((v) => ({ ...v, listedInMenu: event.target.checked }))}
              className="mt-1 h-4 w-4 accent-primary-container"
            />
            <span>
              <span className="block text-label-md text-on-surface">แสดงในเมนูของผู้ใช้</span>
              <span className="block text-label-sm text-on-surface-variant">
                ปิดสำหรับระบบตัวอย่างหรือระบบสำหรับทีมพัฒนา — ยังเข้าผ่าน SSO ได้ตามปกติ (เฉพาะผู้ดูแลระบบ)
              </span>
            </span>
          </label>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id="repo"
            label="Repository"
            hint="เช่น csmju-equipment"
            value={values.repo}
            error={errors.repo}
            inputRef={(el) => (refs.current.repo = el)}
            onChange={(v) => set("repo", v)}
            onBlur={() => check("repo")}
          />
          <div className="space-y-2">
            <label htmlFor="standardsVersion" className="block text-label-md text-on-surface">
              เวอร์ชันมาตรฐาน<span aria-hidden className="text-error"> *</span>
            </label>
            <select
              id="standardsVersion"
              value={values.standardsVersion}
              onChange={(event) => set("standardsVersion", event.target.value)}
              aria-required
              className={inputClass}
            >
              {versionOptions.map((version) => (
                <option key={version} value={version}>
                  {standardsVersionLabel(version, standardsVersions)}
                </option>
              ))}
            </select>
            <p className="text-label-sm text-on-surface-variant">
              เวอร์ชันที่ระบบผ่าน conformance จริง · รายการจาก tag ของ csmju2030-standards
            </p>
          </div>
        </div>
        <TextField
          id="callbackUrl"
          label="Callback URL"
          type="url"
          hint="https เท่านั้น ยกเว้น http://localhost ระหว่างการพัฒนา · path มาตรฐานคือ /auth/callback"
          placeholder="https://equipment.csmju2030.ac.th/auth/callback"
          value={values.callbackUrl}
          error={errors.callbackUrl}
          disabledReason={locked("callbackUrl") ? lockNote : undefined}
          inputRef={(el) => (refs.current.callbackUrl = el)}
          onChange={(v) => set("callbackUrl", v)}
          onBlur={() => check("callbackUrl")}
        />
        <TextField
          id="baseUrl"
          label="Base URL"
          optional
          type="url"
          hint="ที่อยู่หลักของระบบย่อยสำหรับหน้า Monitor — Core Hub จะเรียก <baseUrl>/api/health · เว้นว่างได้"
          placeholder="https://equipment.csmju2030.ac.th"
          value={values.baseUrl}
          error={errors.baseUrl}
          disabledReason={locked("baseUrl") ? lockNote : undefined}
          inputRef={(el) => (refs.current.baseUrl = el)}
          onChange={(v) => set("baseUrl", v)}
          onBlur={() => check("baseUrl")}
        />
      </fieldset>

      <fieldset
        ref={(el) => {
          refs.current.roles = el;
        }}
        tabIndex={-1}
        aria-describedby={errors.roles ? "roles-error" : "roles-hint"}
        disabled={locked("roles")}
        className={`${cardClass} space-y-4 p-6`}
      >
        <legend className="sr-only">การแมปบทบาท</legend>
        <div>
          <h3 className="font-display text-headline-md text-on-surface">
            การแมปบทบาท<span aria-hidden className="text-error"> *</span>
          </h3>
          <p id="roles-hint" className="mt-1 text-body-md text-on-surface-variant">
            {locked("roles")
              ? lockNote
              : "บทบาทที่ไม่ได้เลือกจะถูก Core Hub ปฏิเสธ (403) ตั้งแต่ก่อนเข้าระบบ"}
          </p>
        </div>
        <ul className="divide-y divide-outline-variant/40">
          {CORE_ROLES.map(({ role, label }) => {
            const entry = values.roles[role];
            return (
              <li key={role} className="flex flex-col gap-3 py-3 md:flex-row md:items-center">
                <div className="custom-checkbox flex items-center gap-3 md:w-56">
                  <input
                    id={`role-${role}`}
                    type="checkbox"
                    checked={entry.allowed}
                    onChange={(event) => setRole(role, { allowed: event.target.checked })}
                  />
                  <label htmlFor={`role-${role}`} className="cursor-pointer select-none text-body-md text-on-surface">
                    {label} <span className="text-on-surface-variant">({role})</span>
                  </label>
                </div>
                <div className="flex-1">
                  <label htmlFor={`mapped-${role}`} className="sr-only">
                    บทบาทในระบบย่อยของ {label}
                  </label>
                  <input
                    id={`mapped-${role}`}
                    value={entry.mapped}
                    disabled={!entry.allowed}
                    onChange={(event) => setRole(role, { mapped: event.target.value })}
                    placeholder="ชื่อบทบาทในระบบย่อย"
                    className={`${inputClass} disabled:opacity-50`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        {errors.roles && (
          <p id="roles-error" className="text-label-sm text-error">
            {errors.roles}
          </p>
        )}
      </fieldset>

      {!editing && (
        <fieldset className={`${cardClass} space-y-4 p-6`}>
          <legend className="sr-only">คำขอสิทธิ์พิเศษ</legend>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-headline-md text-on-surface">คำขอสิทธิ์พิเศษ</h3>
              <p className="mt-1 text-body-md text-on-surface-variant">
                ไม่บังคับ · ใช้เมื่อผู้ใช้บางคนต้องได้บทบาทต่างจากปกติในระบบนี้ เช่น นักศึกษาผู้ช่วยแล็บที่ต้องเข้าแบบเจ้าหน้าที่ ·
                เลือกได้เฉพาะบทบาทที่ติ๊กไว้ด้านบน · มีผลเมื่อผู้ดูแลอนุมัติแล้ว และใช้กับการเข้าระบบครั้งถัดไปหลังอนุมัติ
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setExceptions((rows) => [
                  ...rows,
                  {
                    key: nextKey.current++,
                    username: "",
                    role: (Object.keys(mappingOf(values))[0] ?? "staff") as UserRole,
                    reason: "",
                  },
                ])
              }
              className={`${secondaryButtonClass} inline-flex items-center gap-2`}
            >
              <AddIcon className="h-4 w-4" />
              เพิ่มคำขอ
            </button>
          </div>

          {exceptions.map((row, index) => {
            const update = (patch: Partial<ExceptionRow>) =>
              setExceptions((rows) => rows.map((r) => (r.key === row.key ? { ...r, ...patch } : r)));
            return (
              <div key={row.key} className="grid gap-3 rounded-lg border border-outline-variant/40 p-4 md:grid-cols-[1fr_12rem_2fr_auto] md:items-end">
                <div className="space-y-2">
                  <label htmlFor={`ex-user-${row.key}`} className="block text-label-md text-on-surface">ชื่อผู้ใช้</label>
                  <input id={`ex-user-${row.key}`} value={row.username} onChange={(e) => update({ username: e.target.value })} className={inputClass} />
                </div>
                <div className="space-y-2">
                  <label htmlFor={`ex-role-${row.key}`} className="block text-label-md text-on-surface">บทบาทที่ขอ</label>
                  <select id={`ex-role-${row.key}`} value={row.role} onChange={(e) => update({ role: e.target.value as UserRole })} className={inputClass}>
                    {CORE_ROLES.filter(({ role }) => values.roles[role].allowed || role === row.role).map(
                      ({ role, label }) => (
                        <option key={role} value={role} disabled={!values.roles[role].allowed}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor={`ex-reason-${row.key}`} className="block text-label-md text-on-surface">เหตุผล</label>
                  <input id={`ex-reason-${row.key}`} value={row.reason} onChange={(e) => update({ reason: e.target.value })} className={inputClass} />
                </div>
                <button
                  type="button"
                  onClick={() => setExceptions((rows) => rows.filter((r) => r.key !== row.key))}
                  aria-label={`ลบคำขอสิทธิ์พิเศษแถวที่ ${index + 1}`}
                  className={`${iconDangerButtonClass} justify-self-end`}
                >
                  <DeleteIcon className="h-5 w-5" />
                </button>
              </div>
            );
          })}
        </fieldset>
      )}

      {formError && (
        <p role="alert" className="rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Link
          href={
            subsystem
              ? `/backoffice/subsystems/${encodeURIComponent(subsystem.id)}`
              : "/backoffice/subsystems"
          }
          className={secondaryButtonClass}
        >
          ยกเลิก
        </Link>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`relative ${primaryButtonClass} ${pending ? "btn-loading" : ""}`}
        >
          <span className="btn-text">{editing ? "บันทึก" : "ส่งคำขอ"}</span>
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

function TextField({
  id,
  label,
  hint,
  value,
  error,
  type = "text",
  optional = false,
  placeholder,
  disabledReason,
  inputRef,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  value: string;
  error?: string;
  type?: string;
  optional?: boolean;
  placeholder?: string;
  disabledReason?: string;
  inputRef: (el: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const describedBy = error ? `${id}-error` : `${id}-hint`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-label-md text-on-surface">
        {label}
        {!optional && <span aria-hidden className="text-error"> *</span>}
      </label>
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={Boolean(disabledReason)}
        aria-required={!optional}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={`${inputClass} disabled:opacity-60 ${error ? "input-error" : ""}`}
      />
      {error ? (
        <p id={`${id}-error`} className="text-label-sm text-error">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-label-sm text-on-surface-variant">
          {disabledReason ?? hint}
        </p>
      )}
    </div>
  );
}
