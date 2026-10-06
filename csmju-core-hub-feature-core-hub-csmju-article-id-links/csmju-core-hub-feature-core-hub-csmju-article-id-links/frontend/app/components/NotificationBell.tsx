"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { EventIcon, NotificationsIcon } from "./icons";
import RetryButton from "./RetryButton";
import type { AppNotification } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { isExternalLink, safeNotificationLink } from "../lib/notification-link";
import { markAllNotificationsRead, markNotificationRead } from "./notification-actions";

/** The class on now or next today, shown above the stored notifications. */
export type ClassReminder = { title: string; detail: string };

export default function NotificationBell({
  items,
  unread,
  reminder,
  failed = false,
  className = "",
}: {
  items: AppNotification[];
  unread: number;
  reminder: ClassReminder | null;
  /** The notifications could not be loaded — shown as an error, not as none. */
  failed?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const badge = unread + (reminder ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (item: AppNotification) => {
    if (!item.readAt) startTransition(() => void markNotificationRead(item.id));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={badge > 0 ? `การแจ้งเตือน (${badge} รายการใหม่)` : "การแจ้งเตือน"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-surface-variant bg-surface-container-lowest text-primary-container shadow-sm transition-colors hover:bg-surface-container"
      >
        <NotificationsIcon className="h-5 w-5" />
        {/* AppShell spec (ui-design-system.md §5.1): a red dot, the count is in the label. */}
        {badge > 0 && (
          <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error" />
        )}
      </button>

      {open && (
        <div className="fade-slide-up absolute right-0 top-12 z-50 flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-surface-variant bg-surface-container-lowest shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-surface-variant px-4 py-3">
            <p className="text-label-md font-bold text-on-surface">การแจ้งเตือน</p>
            {unread > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => void markAllNotificationsRead())}
                className="text-caption text-primary-container hover:underline disabled:opacity-60"
              >
                อ่านทั้งหมดแล้ว
              </button>
            )}
          </div>

          <ul className="flex-1 overflow-y-auto">
            {reminder && (
              <li className="border-b border-surface-variant bg-primary-container/5">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="flex gap-3 px-4 py-3"
                >
                  <EventIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
                  <span className="min-w-0">
                    <span className="block text-label-md font-bold text-on-surface">
                      {reminder.title}
                    </span>
                    <span className="block text-caption text-on-surface-variant">
                      {reminder.detail}
                    </span>
                  </span>
                </Link>
              </li>
            )}

            {items.map((item) => {
              const content = (
                <>
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      item.readAt ? "bg-transparent" : "bg-primary-container"
                    }`}
                  />
                  <span className="min-w-0">
                    <span
                      className={`block text-label-md ${
                        item.readAt ? "text-on-surface-variant" : "font-bold text-on-surface"
                      }`}
                    >
                      {item.title}
                    </span>
                    {item.body && (
                      <span className="line-clamp-2 block text-caption text-on-surface-variant">
                        {item.body}
                      </span>
                    )}
                    <span className="mt-1 block text-caption text-outline">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </span>
                </>
              );
              const link = safeNotificationLink(item.link);
              const rowClass =
                "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container";
              return (
                <li key={item.id} className="border-b border-surface-variant last:border-b-0">
                  {link ? (
                    <a
                      href={link}
                      onClick={() => openItem(item)}
                      {...(isExternalLink(link)
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className={rowClass}
                    >
                      {content}
                    </a>
                  ) : (
                    <button type="button" onClick={() => openItem(item)} className={rowClass}>
                      {content}
                    </button>
                  )}
                </li>
              );
            })}

            {failed && (
              <li className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <p className="text-body-md text-on-surface-variant">
                  เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง
                </p>
                <RetryButton />
              </li>
            )}

            {!failed && !reminder && items.length === 0 && (
              <li className="px-4 py-10 text-center text-body-md text-on-surface-variant">
                ยังไม่มีการแจ้งเตือน
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
