"use client";

import { inputClass } from "../_components/ui";

/** Labelled text input with its error under it (§8.1). */
export default function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  problem,
  required = false,
  type = "text",
  inputMode,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  problem?: string;
  required?: boolean;
  type?: "text" | "email";
  inputMode?: "numeric" | "text";
  hint?: string;
}) {
  const describedBy = [problem ? `${id}-problem` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-label-md text-on-surface">
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        aria-required={required || undefined}
        aria-invalid={problem ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={inputClass}
      />
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
