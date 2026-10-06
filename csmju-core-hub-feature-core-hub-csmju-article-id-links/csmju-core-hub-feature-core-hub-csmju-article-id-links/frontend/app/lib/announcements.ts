import type { Announcement } from "./api";

/** Client-safe helpers for announcements (api.ts is server-only). */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Same-origin URL of an announcement's cover image, or null without one. */
export function announcementImageUrl(
  announcement: Pick<Announcement, "id" | "imageUpdatedAt">,
): string | null {
  if (!announcement.imageUpdatedAt) return null;
  return `/api/announcements/${encodeURIComponent(announcement.id)}/image?v=${encodeURIComponent(announcement.imageUpdatedAt)}`;
}

/**
 * Public URL of a published announcement's cover image — works signed out,
 * unlike `announcementImageUrl`.
 */
export function publishedAnnouncementImageUrl(
  announcement: Pick<Announcement, "id" | "imageUpdatedAt">,
): string | null {
  if (!announcement.imageUpdatedAt) return null;
  return `/api/published-announcements/${encodeURIComponent(announcement.id)}/image?v=${encodeURIComponent(announcement.imageUpdatedAt)}`;
}

/** Thai message for a failed image upload, from the proxied Core API answer. */
export function describeImageError(status: number, message?: string): string {
  if (status === 413 || /2 MB/.test(message ?? "")) {
    return "รูปภาพต้องมีขนาดไม่เกิน 2 MB";
  }
  if (/JPEG, PNG, GIF or WebP/.test(message ?? "")) {
    return "รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ GIF";
  }
  if (status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
  if (status === 403) return "คุณไม่มีสิทธิ์แก้ไขรูปภาพของประกาศนี้";
  return "อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองอีกครั้ง";
}
