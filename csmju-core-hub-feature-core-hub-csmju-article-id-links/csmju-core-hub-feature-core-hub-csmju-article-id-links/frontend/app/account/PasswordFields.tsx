"use client";

import { CheckIcon, EyeIcon, EyeOffIcon } from "../components/icons";
import { PASSWORD_RULES } from "../lib/password-policy";

/** Shared by /account/password (change) and /account/password/setup (set). */

const inputClass =
  "input-field w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-3 pl-4 pr-11 text-body-md text-on-surface placeholder:text-outline/70";

export type Failure = { message: string; details?: string[] };

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  shown,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label-md text-on-surface">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={shown ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-on-surface"
        >
          {shown ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

/** Every listed rule holds for `password` (the Core API still decides). */
export function meetsPasswordRules(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.ok(password));
}

/** Live checklist under the new-password field. */
export function PasswordRules({
  password,
  extra,
}: {
  password: string;
  /** Rules only the Core API can check, shown greyed out. */
  extra?: string[];
}) {
  return (
    <ul className="space-y-1.5" aria-label="กติการหัสผ่านใหม่">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.ok(password);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-2 text-label-md ${
              ok ? "text-emerald-700" : "text-on-surface-variant"
            }`}
          >
            <CheckIcon className={`h-4 w-4 shrink-0 ${ok ? "" : "opacity-30"}`} />
            {rule.label}
          </li>
        );
      })}
      {extra?.map((label) => (
        <li key={label} className="flex items-center gap-2 text-label-md text-on-surface-variant">
          <CheckIcon className="h-4 w-4 shrink-0 opacity-30" />
          {label}
        </li>
      ))}
    </ul>
  );
}

export function FailureAlert({ failure }: { failure: Failure }) {
  return (
    <div
      role="alert"
      className="space-y-1 rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container"
    >
      {failure.details && failure.details.length > 0 ? (
        <ul className="list-inside list-disc space-y-0.5">
          {failure.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : (
        <p>{failure.message}</p>
      )}
    </div>
  );
}
