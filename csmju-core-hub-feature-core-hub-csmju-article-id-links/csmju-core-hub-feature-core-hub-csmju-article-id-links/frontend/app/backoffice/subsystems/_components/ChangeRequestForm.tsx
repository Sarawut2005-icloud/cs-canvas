"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Subsystem } from "../../../lib/api";
import type { UserRole } from "../../../lib/session";
import {
  CORE_ROLES,
  baseUrlProblem,
  callbackUrlProblem,
} from "../../../lib/subsystems";
import {
  cardClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../../_components/ui";
import { createChangeRequest, type ChangeRequestInput } from "../actions";

type Roles = Record<UserRole, { allowed: boolean; mapped: string }>;

function rolesOf(mapping: Record<string, string>): Roles {
  return Object.fromEntries(
    CORE_ROLES.map(({ role, suggested }) => [
      role,
      role in mapping
        ? { allowed: true, mapped: mapping[role] }
        : { allowed: false, mapped: suggested },
    ]),
  ) as Roles;
}

function mappingOf(roles: Roles): Record<string, string> {
  return Object.fromEntries(
    Object.entries(roles)
      .filter(([, r]) => r.allowed)
      .map(([role, r]) => [role, r.mapped.trim()]),
  );
}

const sameMapping = (a: Record<string, string>, b: Record<string, string>) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/**
 * "ขอแก้ไข" — new values for the fields that are locked once a subsystem is
 * approved. Pre-filled with the current values; only what differs is sent,
 * and nothing changes until an administrator approves.
 */
export default function ChangeRequestForm({
  subsystem,
}: {
  subsystem: Pick<
    Subsystem,
    "id" | "name" | "callbackUrl" | "baseUrl" | "defaultRoleMapping"
  >;
}) {
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState(subsystem.callbackUrl);
  const [baseUrl, setBaseUrl] = useState(subsystem.baseUrl ?? "");
  const [roles, setRoles] = useState(() => rolesOf(subsystem.defaultRoleMapping ?? {}));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const detailHref = `/backoffice/subsystems/${encodeURIComponent(subsystem.id)}`;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const input: ChangeRequestInput = {};
    const mapping = mappingOf(roles);

    if (callbackUrl.trim() !== subsystem.callbackUrl) {
      const problem = callbackUrlProblem(callbackUrl);
      if (problem) return setError(problem);
      input.callbackUrl = callbackUrl.trim();
    }
    if (baseUrl.trim() !== (subsystem.baseUrl ?? "")) {
      const problem = baseUrl.trim() ? baseUrlProblem(baseUrl) : null;
      if (problem) return setError(problem);
      input.baseUrl = baseUrl.trim();
    }
    if (!sameMapping(mapping, subsystem.defaultRoleMapping ?? {})) {
      const allowed = Object.values(roles).filter((r) => r.allowed);
      if (allowed.length === 0) return setError("เลือกบทบาทที่เข้าระบบนี้ได้อย่างน้อย 1 บทบาท");
      if (allowed.some((r) => !r.mapped.trim()))
        return setError("กรอกชื่อบทบาทในระบบย่อยให้ครบทุกบทบาทที่เลือก");
      input.defaultRoleMapping = mapping;
    }
    if (Object.keys(input).length === 0) {
      return setError("ยังไม่ได้เปลี่ยนค่าใด — แก้อย่างน้อย 1 ช่องก่อนยื่นคำขอ");
    }

    startTransition(async () => {
      const result = await createChangeRequest(subsystem.id, input);
      if (!result.ok) return setError(result.error);
      router.push(detailHref);
      router.refresh();
    });
  };

  return (
    <form noValidate onSubmit={submit} className="fade-slide-up stagger-1 space-y-6">
      <fieldset className={`${cardClass} space-y-4 p-6`}>
        <legend className="sr-only">URL</legend>
        <h3 className="font-display text-headline-md text-on-surface">URL ของระบบ</h3>
        <div className="space-y-2">
          <label htmlFor="cr-callbackUrl" className="block text-label-md text-on-surface">
            Callback URL
          </label>
          <input
            id="cr-callbackUrl"
            type="url"
            value={callbackUrl}
            onChange={(e) => setCallbackUrl(e.target.value)}
            className={inputClass}
          />
          <p className="text-label-sm text-on-surface-variant">
            https เท่านั้น ยกเว้น http://localhost ช่วงก่อนเปิดใช้ · ตรวจซ้ำอีกครั้งตอนอนุมัติ
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="cr-baseUrl" className="block text-label-md text-on-surface">
            Base URL <span className="text-on-surface-variant">(เว้นว่าง = ลบ)</span>
          </label>
          <input
            id="cr-baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className={inputClass}
          />
        </div>
      </fieldset>

      <fieldset className={`${cardClass} space-y-4 p-6`}>
        <legend className="sr-only">การแมปบทบาท</legend>
        <h3 className="font-display text-headline-md text-on-surface">การแมปบทบาท</h3>
        <ul className="divide-y divide-outline-variant/40">
          {CORE_ROLES.map(({ role, label }) => {
            const entry = roles[role];
            const set = (patch: Partial<typeof entry>) =>
              setRoles((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));
            return (
              <li key={role} className="flex flex-col gap-3 py-3 md:flex-row md:items-center">
                <div className="custom-checkbox flex items-center gap-3 md:w-56">
                  <input
                    id={`cr-role-${role}`}
                    type="checkbox"
                    checked={entry.allowed}
                    onChange={(e) => set({ allowed: e.target.checked })}
                  />
                  <label htmlFor={`cr-role-${role}`} className="cursor-pointer select-none text-body-md text-on-surface">
                    {label} <span className="text-on-surface-variant">({role})</span>
                  </label>
                </div>
                <div className="flex-1">
                  <label htmlFor={`cr-mapped-${role}`} className="sr-only">
                    บทบาทในระบบย่อยของ {label}
                  </label>
                  <input
                    id={`cr-mapped-${role}`}
                    value={entry.mapped}
                    disabled={!entry.allowed}
                    onChange={(e) => set({ mapped: e.target.value })}
                    className={`${inputClass} disabled:opacity-50`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Link href={detailHref} className={secondaryButtonClass}>
          ยกเลิก
        </Link>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`relative ${primaryButtonClass} ${pending ? "btn-loading" : ""}`}
        >
          <span className="btn-text">ยื่นคำขอแก้ไข</span>
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
