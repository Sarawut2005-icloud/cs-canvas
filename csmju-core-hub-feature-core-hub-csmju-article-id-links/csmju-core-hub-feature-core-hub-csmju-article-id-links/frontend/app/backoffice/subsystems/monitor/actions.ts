"use server";

import { ApiError, getSubsystemHealth, type SubsystemHealth } from "../../../lib/api";
import { describeError, type ActionResult } from "../../../lib/subsystems";

/**
 * Probes one subsystem through the Core API (`GET /subsystems/:id/health`).
 * The browser never talks to a subsystem itself — the API only ever calls the
 * base URL stored in the registry. A read, so nothing is revalidated.
 */
export async function checkSubsystemHealth(
  id: string,
): Promise<ActionResult<SubsystemHealth>> {
  try {
    return { ok: true, data: await getSubsystemHealth(id) };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, error: describeError(err) };
    }
    return { ok: false, error: "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง" };
  }
}
