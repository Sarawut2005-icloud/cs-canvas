"use client";

import { useState, useTransition } from "react";
import { setRegisterGrant } from "./actions";

/**
 * "ลงทะเบียนระบบย่อยได้" for one account. Admins have the right through
 * their role, so their switch is fixed on; everyone else gets it per account.
 */
export default function RegisterGrantSwitch({
  userId,
  email,
  granted,
  viaRole,
}: {
  userId: string;
  email: string;
  granted: boolean;
  viaRole: boolean;
}) {
  const [on, setOn] = useState(granted || viaRole);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !on;
    setError(null);
    startTransition(async () => {
      const result = await setRegisterGrant(userId, next);
      if (result.ok) setOn(next);
      else setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`ลงทะเบียนระบบย่อยได้ — ${email}`}
        title={viaRole ? "ผู้ดูแลระบบลงทะเบียนได้จากบทบาทอยู่แล้ว" : undefined}
        disabled={viaRole || pending}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          on ? "bg-primary-container" : "bg-outline-variant"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      {viaRole && (
        <span className="text-label-sm text-on-surface-variant">จากบทบาท</span>
      )}
      {error && (
        <span role="alert" className="text-label-sm text-error">
          {error}
        </span>
      )}
    </div>
  );
}
