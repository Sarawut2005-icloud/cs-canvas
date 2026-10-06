"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { UserRole } from "../../../lib/session";
import { CORE_ROLES } from "../../../lib/subsystems";
import { requestException } from "../actions";
import { inputClass, primaryButtonClass } from "../../_components/ui";

/**
 * Owner asks for one person to get a different role in this subsystem.
 * Only roles in the subsystem's role mapping can be asked for (the API
 * refuses anything else), and an approved exception applies to tokens
 * issued after the approval.
 */
export default function ExceptionRequestForm({
  subsystemId,
  mappedRoles,
}: {
  subsystemId: string;
  mappedRoles: string[];
}) {
  const router = useRouter();
  const choices = CORE_ROLES.filter(({ role }) => mappedRoles.includes(role));
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<UserRole | "">(choices[0]?.role ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (!username.trim() || !reason.trim() || !role) {
      setError("กรอกชื่อผู้ใช้ บทบาท และเหตุผลให้ครบ");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await requestException(subsystemId, {
        username: username.trim(),
        role,
        reason: reason.trim(),
      });
      if (!result.ok) return setError(result.error);
      setUsername("");
      setReason("");
      setNotice("ส่งคำขอแล้ว รอผู้ดูแลระบบพิจารณา · มีผลกับการเข้าระบบครั้งถัดไปหลังอนุมัติ");
      router.refresh();
    });
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-4 border-t border-outline-variant/40 px-6 py-5">
      <div>
        <p className="text-label-md text-on-surface">ขอสิทธิ์พิเศษเพิ่ม</p>
        <p className="mt-1 text-body-md text-on-surface-variant">
          เลือกได้เฉพาะบทบาทที่อยู่ในการจับคู่บทบาทของระบบนี้ · มีผลเมื่อผู้ดูแลอนุมัติแล้ว
          และใช้กับการเข้าระบบครั้งถัดไปหลังอนุมัติ
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_12rem_2fr]">
        <div className="space-y-2">
          <label htmlFor="ex-username" className="block text-label-md text-on-surface">
            ชื่อผู้ใช้<span aria-hidden className="text-error"> *</span>
          </label>
          <input id="ex-username" value={username} onChange={(e) => setUsername(e.target.value)} aria-required className={inputClass} />
        </div>
        <div className="space-y-2">
          <label htmlFor="ex-role" className="block text-label-md text-on-surface">บทบาทที่ขอ</label>
          <select id="ex-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} disabled={choices.length === 0} className={inputClass}>
            {choices.map(({ role: value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="ex-reason" className="block text-label-md text-on-surface">
            เหตุผล<span aria-hidden className="text-error"> *</span>
          </label>
          <input id="ex-reason" value={reason} onChange={(e) => setReason(e.target.value)} aria-required className={inputClass} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-label-sm text-error">{error}</p>
      )}
      {notice && (
        <p role="status" className="text-label-md text-primary-container">{notice}</p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} aria-busy={pending} className={`relative ${primaryButtonClass} ${pending ? "btn-loading" : ""}`}>
          <span className="btn-text">ส่งคำขอ</span>
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
