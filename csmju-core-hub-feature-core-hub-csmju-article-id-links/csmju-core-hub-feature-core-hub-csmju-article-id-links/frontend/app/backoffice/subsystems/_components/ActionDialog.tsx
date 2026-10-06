"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import type { ActionResult } from "../../../lib/subsystems";
import Modal from "../../_components/Modal";
import {
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../../_components/ui";

/**
 * Confirmation dialog for a registry action, optionally asking for a reason.
 * Errors stay inside the dialog (a toast would vanish before it is read).
 */
export default function ActionDialog({
  title,
  description,
  confirmLabel,
  tone = "primary",
  reason = "none",
  reasonLabel = "เหตุผล",
  children,
  onConfirm,
  onClose,
  onDone,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  reason?: "none" | "optional" | "required";
  reasonLabel?: string;
  children?: ReactNode;
  onConfirm: (reason: string) => Promise<ActionResult<unknown>>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reasonId = useId();
  const errorId = useId();

  const submit = () => {
    const trimmed = text.trim();
    if (reason === "required" && !trimmed) {
      setFieldError(`กรุณาระบุ${reasonLabel}`);
      return;
    }
    setFieldError(null);
    setError(null);
    startTransition(async () => {
      const result = await onConfirm(trimmed);
      if (result.ok) {
        onDone();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Modal title={title} onClose={pending ? () => {} : onClose}>
      <div className="space-y-4">
        <div className="text-body-md text-on-surface-variant">{description}</div>

        {children}

        {reason !== "none" && (
          <div className="space-y-2">
            <label htmlFor={reasonId} className="block text-label-md text-on-surface">
              {reasonLabel}
              {reason === "required" ? (
                <span aria-hidden className="text-error"> *</span>
              ) : (
                <span className="text-on-surface-variant"> (ไม่บังคับ)</span>
              )}
            </label>
            <textarea
              id={reasonId}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onBlur={() =>
                reason === "required" && !text.trim()
                  ? setFieldError(`กรุณาระบุ${reasonLabel}`)
                  : setFieldError(null)
              }
              rows={3}
              maxLength={500}
              aria-required={reason === "required"}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? errorId : undefined}
              className={`${inputClass} resize-y ${fieldError ? "input-error" : ""}`}
            />
            {fieldError && (
              <p id={errorId} className="text-label-sm text-error">
                {fieldError}
              </p>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={secondaryButtonClass}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            aria-busy={pending}
            className={`relative ${
              tone === "danger" ? dangerButtonClass : primaryButtonClass
            } ${pending ? "btn-loading" : ""}`}
          >
            <span className="btn-text">{confirmLabel}</span>
            <span className="dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
