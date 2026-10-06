"use client";

import { useState, useTransition } from "react";
import { AddIcon, DeleteIcon, EditIcon } from "../../components/icons";
import type { Announcement } from "../../lib/api";
import { announcementImageUrl } from "../../lib/announcements";
import { formatDate } from "../../lib/format";
import { ConfirmDeleteModal } from "../_components/Modal";
import {
  iconButtonClass,
  iconDangerButtonClass,
  primaryButtonClass,
  tdClass,
  thClass,
} from "../_components/ui";
import AnnouncementFormModal from "./AnnouncementFormModal";
import { deleteAnnouncement } from "./actions";

/**
 * Announcement rows with inline create / edit / delete. Used by the overview
 * card (a few recent rows) and the full list on /backoffice/news.
 */
export default function AnnouncementsTable({
  announcements,
  canDelete,
  showCreate = false,
  emptyMessage = "ยังไม่มีประกาศ",
  initialEditId,
}: {
  announcements: Announcement[];
  /** Only admins hold `content:delete`; staff do not see the button. */
  canDelete: boolean;
  showCreate?: boolean;
  emptyMessage?: string;
  /** Opens this announcement in the editor on arrival (header search). */
  initialEditId?: string;
}) {
  const [editing, setEditing] = useState<Announcement | "new" | null>(
    () => announcements.find((a) => a.id === initialEditId) ?? null,
  );
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmDelete = () => {
    if (!deleting || pending) return;
    const target = deleting;
    startTransition(async () => {
      const result = await deleteAnnouncement(target.id);
      if (result.ok) {
        setDeleting(null);
        setDeleteError("");
      } else {
        setDeleteError(result.error);
      }
    });
  };

  return (
    <>
      {showCreate && (
        <div className="flex justify-end border-b border-outline-variant/40 px-6 py-4">
          <button
            type="button"
            onClick={() => setEditing("new")}
            className={primaryButtonClass}
          >
            <AddIcon className="h-4 w-4" />
            สร้างประกาศใหม่
          </button>
        </div>
      )}

      {announcements.length === 0 ? (
        <p className="px-6 py-12 text-center text-body-md text-on-surface-variant">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                <th className={thClass}>หัวข้อประกาศ</th>
                <th className={thClass}>หมวดหมู่</th>
                <th className={thClass}>วันที่เผยแพร่</th>
                <th className={thClass}>สถานะ</th>
                <th className={`${thClass} text-right`}>จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-body-md">
              {announcements.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-surface/50"
                >
                  <td className={`${tdClass} font-medium text-on-surface`}>
                    <span className="flex items-center gap-3">
                      {announcementImageUrl(item) && (
                        // eslint-disable-next-line @next/next/no-img-element -- served by the auth proxy, not next/image
                        <img
                          src={announcementImageUrl(item)!}
                          alt=""
                          className="h-10 w-16 shrink-0 rounded-md bg-surface-container object-cover"
                        />
                      )}
                      {item.title}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <span className="inline-block whitespace-nowrap rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary-container">
                      {item.category}
                    </span>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-on-surface-variant`}>
                    {item.publishedAt ? formatDate(item.publishedAt) : "—"}
                  </td>
                  <td className={tdClass}>
                    <span
                      className={`flex items-center gap-1.5 whitespace-nowrap text-label-sm ${
                        item.isPublished ? "text-success" : "text-outline"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          item.isPublished ? "bg-success" : "bg-outline"
                        }`}
                      />
                      {item.isPublished ? "เผยแพร่" : "ไม่เผยแพร่"}
                    </span>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      aria-label={`แก้ไข ${item.title}`}
                      className={iconButtonClass}
                    >
                      <EditIcon className="h-5 w-5" />
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError("");
                          setDeleting(item);
                        }}
                        aria-label={`ลบ ${item.title}`}
                        className={iconDangerButtonClass}
                      >
                        <DeleteIcon className="h-5 w-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <AnnouncementFormModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDeleteModal
          title="ลบประกาศ"
          message={
            <>
              ต้องการลบประกาศ “{deleting.title}” ใช่หรือไม่?
              การลบไม่สามารถย้อนกลับได้
              {deleteError && (
                <span className="mt-4 block rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
                  {deleteError}
                </span>
              )}
            </>
          }
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
