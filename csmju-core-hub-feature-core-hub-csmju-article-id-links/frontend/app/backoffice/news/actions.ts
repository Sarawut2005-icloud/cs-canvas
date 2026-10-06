"use server";

import { revalidatePath } from "next/cache";
import {
  apiFetch,
  ApiError,
  type Announcement,
  type ExternalContentKind,
} from "../../lib/api";
import { describeError, type ActionResult } from "../../lib/subsystems";

/**
 * Server actions for announcements. Each call uses the signed-in user's own
 * token, so the Core API decides whether they may (staff cannot delete).
 */

export type AnnouncementInput = {
  title: string;
  content: string;
  category: string;
  isPublished: boolean;
};

async function run<T>(call: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await call();
    // The overview card and the full list both show announcements.
    revalidatePath("/backoffice", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, error: describeError(err) };
    }
    return { ok: false, error: "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง" };
  }
}

const announcementPath = (id: string) =>
  `/announcements/${encodeURIComponent(id)}`;

export async function createAnnouncement(input: AnnouncementInput) {
  return run(() =>
    apiFetch<Announcement>("/announcements", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function updateAnnouncement(
  id: string,
  input: Partial<AnnouncementInput>,
) {
  return run(() =>
    apiFetch<Announcement>(announcementPath(id), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteAnnouncement(id: string) {
  return run(() =>
    apiFetch<{ id: string; deleted: true }>(announcementPath(id), {
      method: "DELETE",
    }),
  );
}

/**
 * Re-renders the announcement lists after the image proxy changed a cover
 * image — the proxy is a route handler, so it cannot revalidate by itself.
 */
export async function refreshAnnouncements() {
  revalidatePath("/backoffice", "layout");
}

/* csmju.com items on the public front page — admin only (the API checks). */

const hiddenPath = (kind: ExternalContentKind, externalId: string) =>
  `/external-content/hidden/${kind}/${encodeURIComponent(externalId)}`;

async function runExternal<T>(call: () => Promise<T>) {
  const result = await run(call);
  // The front page reads the hidden list on every render; refresh its cache.
  if (result.ok) revalidatePath("/");
  return result;
}

export async function hideExternalContent(
  kind: ExternalContentKind,
  externalId: string,
  title: string,
) {
  return runExternal(() =>
    apiFetch(hiddenPath(kind, externalId), {
      method: "PUT",
      body: JSON.stringify({ title }),
    }),
  );
}

export async function showExternalContent(
  kind: ExternalContentKind,
  externalId: string,
) {
  return runExternal(() =>
    apiFetch(hiddenPath(kind, externalId), { method: "DELETE" }),
  );
}
