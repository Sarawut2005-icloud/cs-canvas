"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
import { CloseIcon } from "../../components/icons";
import { dangerButtonClass, secondaryButtonClass } from "./ui";

const subscribeNoop = () => () => {};

/** Dialog widths — `md` (448px) is the default of §8.3; wider ones hold tables. */
const SIZE_CLASS = {
  md: "max-w-md",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

export default function Modal({
  title,
  onClose,
  size = "md",
  children,
}: {
  title: string;
  onClose: () => void;
  size?: keyof typeof SIZE_CLASS;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Portal target exists only in the browser; the server (and the hydration
  // pass) render nothing, so markup never mismatches.
  const host = useSyncExternalStore(
    subscribeNoop,
    () => document.body,
    () => null,
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();

      // Keep Tab inside the dialog (ui-design-system.md §8.3).
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Move focus in on open and hand it back to whatever opened the dialog.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const target =
      dialogRef.current?.querySelector<HTMLElement>(
        "textarea, input, select",
      ) ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    return () => opener?.focus();
  }, []);

  if (!host) return null;

  // Rendered at <body>: cards use `.fade-slide-up` (a `transform` animation
  // with `forwards`), and a transformed ancestor turns `position: fixed` into
  // a box inside itself — the dialog would then sit under the next card.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        className={`fade-slide-up relative max-h-[calc(100dvh-2rem)] w-full ${SIZE_CLASS[size]} overflow-y-auto rounded-xl bg-surface-container-lowest p-6 shadow-xl`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h3 id={titleId} className="font-display text-headline-md text-on-surface">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-lg p-1.5 text-outline transition-colors hover:bg-surface-variant/50 hover:text-on-surface"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    host,
  );
}

export function ConfirmDeleteModal({
  title,
  message,
  blockedReason,
  onConfirm,
  onClose,
}: {
  title: string;
  message: React.ReactNode;
  /** When set, deletion is not allowed and this explains why. */
  blockedReason?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-body-md text-on-surface-variant">{message}</p>
      {blockedReason && (
        <p className="mt-4 rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
          {blockedReason}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={secondaryButtonClass}>
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={Boolean(blockedReason)}
          className={dangerButtonClass}
        >
          ลบ
        </button>
      </div>
    </Modal>
  );
}
