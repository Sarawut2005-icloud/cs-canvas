"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "../../lib/api";
import { describeRegistryError, type ActionResult } from "../../lib/subsystems";

/** The only permission an admin may give one account today (handoff 2.8). */
const SUBSYSTEM_CREATE = "subsystem:create";

/**
 * Turns "ลงทะเบียนระบบย่อยได้" on or off for one account —
 * PUT / DELETE /users/:id/permissions/subsystem:create (admin only; the
 * Core API checks the caller and logs the change with ids only).
 */
export async function setRegisterGrant(
  userId: string,
  granted: boolean,
): Promise<ActionResult> {
  try {
    await apiFetch(
      `/users/${encodeURIComponent(userId)}/permissions/${encodeURIComponent(SUBSYSTEM_CREATE)}`,
      { method: granted ? "PUT" : "DELETE" },
    );
    revalidatePath("/backoffice/users");
    return { ok: true, data: null };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof ApiError
          ? describeRegistryError(err)
          : "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง",
    };
  }
}
