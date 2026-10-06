"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CampaignIcon, DeleteIcon, EditIcon } from "../../components/icons";
import type { Announcement } from "../../lib/api";
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  announcementImageUrl,
  describeImageError,
} from "../../lib/announcements";
import Modal from "../_components/Modal";
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../_components/ui";
import {
  createAnnouncement,
  refreshAnnouncements,
  updateAnnouncement,
  type AnnouncementInput,
} from "./actions";

const CATEGORY_SUGGESTIONS = ["วิชาการ", "ทุนการศึกษา", "กิจกรรม", "ทั่วไป"];

/** Sends the picked image (or its removal) through the same-origin proxy. */
async function saveImage(
  id: string,
  change: { file: File } | { remove: true },
): Promise<string | null> {
  const url = `/api/announcements/${encodeURIComponent(id)}/image`;
  let res: Response;
  try {
    if ("file" in change) {
      const body = new FormData();
      body.append("image", change.file);
      res = await fetch(url, { method: "PUT", body });
    } else {
      res = await fetch(url, { method: "DELETE" });
    }
  } catch {
    return describeImageError(0);
  }
  if (res.ok) return null;
  const body = await res.json().catch(() => null);
  return describeImageError(res.status, body?.error?.message);
}

/**
 * Create / edit dialog for one announcement, including its cover image.
 * Opened from the announcement tables and from the sidebar button.
 */
export default function AnnouncementFormModal({
  initial,
  onClose,
}: {
  initial: Announcement | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);

  const existingImage = initial ? announcementImageUrl(initial) : null;
  // The picked file and its blob: URL for the preview, replaced together.
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(
    null,
  );
  const file = picked?.file ?? null;
  const preview = picked?.url ?? null;
  const [removeImage, setRemoveImage] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // A new announcement whose text saved but whose image did not: further
  // attempts update that record instead of creating a duplicate.
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const replacePicked = (next: File | null) =>
    setPicked(next ? { file: next, url: URL.createObjectURL(next) } : null);

  // Release each preview URL once it is replaced or the dialog closes.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const shownImage = preview ?? (removeImage ? null : existingImage);

  const pickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    if (!IMAGE_TYPES.includes(chosen.type)) {
      setError("รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ GIF");
      return;
    }
    if (chosen.size > MAX_IMAGE_BYTES) {
      setError("รูปภาพต้องมีขนาดไม่เกิน 2 MB");
      return;
    }
    setError("");
    replacePicked(chosen);
    setRemoveImage(false);
  };

  const clearImage = () => {
    replacePicked(null);
    setRemoveImage(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input: AnnouncementInput = {
      title: title.trim(),
      category: category.trim(),
      content: content.trim(),
      isPublished,
    };
    if (!input.title || !input.category || !input.content) {
      setError("กรุณากรอกหัวข้อ หมวดหมู่ และรายละเอียดให้ครบ");
      return;
    }
    setError("");

    startTransition(async () => {
      const targetId = initial?.id ?? savedId;
      const result = targetId
        ? await updateAnnouncement(targetId, input)
        : await createAnnouncement(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const id = result.data.id;
      setSavedId(id);

      const imageChange = file
        ? ({ file } as const)
        : removeImage && existingImage
          ? ({ remove: true } as const)
          : null;
      const imageError = imageChange ? await saveImage(id, imageChange) : null;
      if (imageChange) await refreshAnnouncements();

      if (imageError) {
        setError(`บันทึกประกาศแล้ว แต่${imageError}`);
        return;
      }
      onClose();
    });
  };

  return (
    <Modal title={initial ? "แก้ไขประกาศ" : "สร้างประกาศใหม่"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-2">
          <span className="text-label-md text-on-surface">หัวข้อประกาศ</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className={inputClass}
            placeholder="เช่น กำหนดการลงทะเบียนเรียน"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-label-md text-on-surface">หมวดหมู่</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={50}
            list="announcement-categories"
            className={inputClass}
            placeholder="เลือกหรือพิมพ์หมวดหมู่"
          />
          <datalist id="announcement-categories">
            {CATEGORY_SUGGESTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-label-md text-on-surface">รายละเอียด</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={5000}
            rows={4}
            className={`${inputClass} resize-y`}
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-label-md text-on-surface">
            รูปภาพประกอบ{" "}
            <span className="font-normal text-on-surface-variant">
              (ไม่บังคับ · JPG, PNG, WebP, GIF ไม่เกิน 2 MB)
            </span>
          </span>
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            onChange={pickFile}
            className="hidden"
          />
          {shownImage ? (
            <div className="relative overflow-hidden rounded-lg border border-outline-variant">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob: previews and the auth proxy cannot go through next/image */}
              <img
                src={shownImage}
                alt="ตัวอย่างรูปประกอบ"
                className="aspect-[16/9] w-full bg-surface-container object-cover"
              />
              <div className="absolute right-2 top-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  aria-label="เปลี่ยนรูป"
                  className="rounded-lg bg-surface-container-lowest/90 p-2 text-on-surface shadow-sm transition-colors hover:text-primary-container"
                >
                  <EditIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={clearImage}
                  aria-label="ลบรูป"
                  className="rounded-lg bg-surface-container-lowest/90 p-2 text-on-surface shadow-sm transition-colors hover:text-error"
                >
                  <DeleteIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface text-on-surface-variant transition-colors hover:border-primary-container hover:text-primary-container"
            >
              <CampaignIcon className="h-8 w-8" />
              <span className="text-label-md">คลิกเพื่อเลือกรูปภาพ</span>
            </button>
          )}
        </div>

        <div className="custom-checkbox flex items-center gap-3">
          <input
            id="announcement-published"
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          <label
            htmlFor="announcement-published"
            className="cursor-pointer select-none text-body-md text-on-surface-variant"
          >
            เผยแพร่ประกาศนี้
          </label>
        </div>

        {error && (
          <p className="rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={pending}
            className={`${primaryButtonClass} disabled:opacity-60`}
          >
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
