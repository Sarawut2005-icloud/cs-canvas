"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Person, PersonStatus } from "../../lib/api";
import {
  PERSON_STATUS_BADGE,
  PERSON_STATUSES,
  PERSON_TYPE_LABELS,
  personDisplayName,
} from "../../lib/people";
import Modal from "../_components/Modal";
import StatusBadge from "../_components/StatusBadge";
import { inputClass, primaryButtonClass } from "../_components/ui";
import { loadAdvisors, updatePerson } from "../people/actions";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-label-sm text-on-surface-variant">{label}</dt>
      <dd className="text-body-md text-on-surface">{value ?? "—"}</dd>
    </div>
  );
}

/**
 * Detail panel for one person: registry fields, advisors, and — for admins —
 * the two things the API lets them change (status, Core Hub account link).
 */
export default function PersonPanel({
  person,
  canManage,
  onClose,
  onSaved,
}: {
  person: Person;
  canManage: boolean;
  onClose: () => void;
  onSaved: (person: Person) => void;
}) {
  const router = useRouter();
  // Staff have no advisors; only students trigger the lookup below.
  const isStudent = person.personType === "STUDENT";
  const [advisors, setAdvisors] = useState<Person[] | null>(isStudent ? null : []);
  const [advisorsError, setAdvisorsError] = useState<string | null>(null);
  const [status, setStatus] = useState<PersonStatus>(person.status);
  const [coreUserEmail, setCoreUserEmail] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!isStudent) return;
    let cancelled = false;
    loadAdvisors(person.personCode).then((result) => {
      if (cancelled) return;
      if (result.ok) setAdvisors(result.data);
      else setAdvisorsError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [person.personCode, isStudent]);

  const save = (patch: Parameters<typeof updatePerson>[1]) =>
    startTransition(async () => {
      setMessage(null);
      const result = await updatePerson(person.personCode, patch);
      if (!result.ok) return setMessage({ tone: "error", text: result.error });
      onSaved(result.data);
      setCoreUserEmail("");
      setMessage({ tone: "ok", text: "บันทึกแล้ว" });
      router.refresh();
    });

  return (
    <Modal title={personDisplayName(person)} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-surface-variant px-2.5 py-1 text-label-sm text-on-surface-variant">
            {PERSON_TYPE_LABELS[person.personType]}
          </span>
          <StatusBadge status={PERSON_STATUS_BADGE[person.status]} />
          {person.coreUserId ? (
            <span className="rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary-container">
              ผูกบัญชี Core Hub แล้ว
            </span>
          ) : (
            <span className="rounded-full bg-surface-variant px-2.5 py-1 text-label-sm text-on-surface-variant">
              ยังไม่ผูกบัญชี
            </span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="รหัส" value={<span className="tabular-nums">{person.personCode}</span>} />
          <Field label="ปีเข้า (พ.ศ.)" value={person.entryYear} />
          <Field label="ชื่อภาษาอังกฤษ" value={person.fullNameEn} />
          <Field
            label="อีเมลมหาวิทยาลัย"
            value={person.universityEmail === undefined ? "ไม่มีสิทธิ์ดู" : person.universityEmail}
          />
          <Field label="คณะ" value={person.faculty.nameTh} />
          <Field label="สาขา" value={person.department?.nameTh} />
          <Field
            label="หลักสูตร"
            value={
              person.curriculum
                ? `${person.curriculum.nameTh} (${person.curriculum.curriculumYear})`
                : null
            }
          />
        </dl>

        {isStudent && (
          <section>
            <h4 className="mb-2 text-label-md text-on-surface">อาจารย์ที่ปรึกษา</h4>
            {advisorsError ? (
              <p className="text-body-md text-error">{advisorsError}</p>
            ) : advisors === null ? (
              <p className="text-body-md text-on-surface-variant">กำลังโหลด...</p>
            ) : advisors.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">ยังไม่มีอาจารย์ที่ปรึกษาที่ใช้งานอยู่</p>
            ) : (
              <ul className="space-y-1 text-body-md text-on-surface">
                {advisors.map((advisor) => (
                  <li key={advisor.personCode} className="flex flex-wrap items-baseline gap-x-2">
                    <span>{personDisplayName(advisor)}</span>
                    {advisor.universityEmail && (
                      <a
                        href={`mailto:${advisor.universityEmail}`}
                        className="text-label-sm text-on-surface-variant hover:text-primary-container hover:underline"
                      >
                        {advisor.universityEmail}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {canManage && (
          <section className="space-y-4 border-t border-outline-variant/40 pt-4">
            <h4 className="text-label-md text-on-surface">จัดการ (ผู้ดูแลระบบ)</h4>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (status !== person.status) save({ status });
              }}
              className="flex items-end gap-2"
            >
              <label className="block flex-1 space-y-1">
                <span className="text-label-sm text-on-surface-variant">สถานะ</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as PersonStatus)}
                  className={inputClass}
                >
                  {PERSON_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {PERSON_STATUS_BADGE[value].label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={pending || status === person.status}
                className={`${primaryButtonClass} disabled:opacity-50`}
              >
                แก้สถานะ
              </button>
            </form>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const email = coreUserEmail.trim().toLowerCase();
                if (email) save({ coreUserEmail: email });
              }}
              className="flex items-end gap-2"
            >
              <label className="block flex-1 space-y-1">
                <span className="text-label-sm text-on-surface-variant">
                  ผูกบัญชี Core Hub (อีเมลที่ใช้เข้าสู่ระบบ)
                </span>
                <input
                  type="email"
                  value={coreUserEmail}
                  onChange={(event) => setCoreUserEmail(event.target.value)}
                  placeholder="เช่น student@core.local"
                  className={inputClass}
                />
              </label>
              <button
                type="submit"
                disabled={pending || !coreUserEmail.trim()}
                className={`${primaryButtonClass} disabled:opacity-50`}
              >
                ผูกบัญชี
              </button>
            </form>

            {message && (
              <p
                role={message.tone === "error" ? "alert" : "status"}
                className={`rounded-lg px-4 py-3 text-label-md ${
                  message.tone === "error"
                    ? "bg-error-container text-on-error-container"
                    : "bg-success/10 text-emerald-700"
                }`}
              >
                {message.text}
              </p>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
