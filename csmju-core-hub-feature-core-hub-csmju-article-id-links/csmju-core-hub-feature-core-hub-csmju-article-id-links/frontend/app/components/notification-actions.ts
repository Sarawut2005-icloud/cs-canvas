"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "../lib/api";

/** Marks one notification read; false when the Core API refused. */
export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    await apiFetch(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    });
    revalidatePath("/", "layout");
    return true;
  } catch {
    return false;
  }
}

export async function markAllNotificationsRead(): Promise<boolean> {
  try {
    await apiFetch("/notifications", {
      method: "PATCH",
      body: JSON.stringify({ read: true }),
    });
    revalidatePath("/", "layout");
    return true;
  } catch {
    return false;
  }
}
