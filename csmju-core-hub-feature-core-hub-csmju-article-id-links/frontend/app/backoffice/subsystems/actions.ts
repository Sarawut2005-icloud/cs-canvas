"use server";

import { revalidatePath } from "next/cache";
import {
  apiFetch,
  ApiError,
  type ChangeRequest,
  type Subsystem,
  type SubsystemCategory,
} from "../../lib/api";
import { describeRegistryError, type ActionResult } from "../../lib/subsystems";

/**
 * Server actions for the subsystem pages. Each one calls the Core API with
 * the caller's own token (the API decides whether they may) and returns a
 * result the component can show — never throws, never swallows the error.
 */

export type SubsystemInput = {
  name: string;
  displayName: string;
  repo: string;
  standardsVersion: string;
  callbackUrl: string;
  /** Origin for the Monitor's health probe; "" clears it on edit. */
  baseUrl?: string;
  category?: SubsystemCategory;
  /** "" clears it. */
  description?: string;
  /** Admins only — the API refuses it from anyone else. */
  listedInMenu?: boolean;
  defaultRoleMapping: Record<string, string>;
  requestedExceptions?: { username: string; role: string; reason: string }[];
};

async function run<T>(call: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await call();
    // Root layout: the subsystem pages and both sidebars (which list live
    // subsystems) all reflect the change.
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, error: describeRegistryError(err) };
    }
    return { ok: false, error: "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง" };
  }
}

const post = <T = Subsystem>(path: string, body?: object) =>
  apiFetch<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });

const subsystemPath = (id: string) => `/subsystems/${encodeURIComponent(id)}`;

export async function createSubsystem(input: SubsystemInput) {
  return run(() => post<Subsystem>("/subsystems", input));
}

export async function updateSubsystem(
  id: string,
  input: Partial<SubsystemInput>,
) {
  return run(() =>
    apiFetch<Subsystem>(subsystemPath(id), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteSubsystem(id: string) {
  return run(() =>
    apiFetch<{ id: string; deleted: true }>(subsystemPath(id), {
      method: "DELETE",
    }),
  );
}

export async function approveSubsystem(id: string, activate: boolean) {
  return run(async () => {
    const approved = await post(`${subsystemPath(id)}/approve`);
    return activate ? post(`${subsystemPath(id)}/activate`) : approved;
  });
}

export async function rejectSubsystem(id: string, reason: string) {
  return run(() => post(`${subsystemPath(id)}/reject`, { reason }));
}

export async function resubmitSubsystem(id: string) {
  return run(() => post(`${subsystemPath(id)}/resubmit`));
}

export async function activateSubsystem(id: string) {
  return run(() => post(`${subsystemPath(id)}/activate`));
}

export async function deactivateSubsystem(id: string, reason: string) {
  return run(() =>
    post(`${subsystemPath(id)}/deactivate`, reason ? { reason } : {}),
  );
}

export async function suspendSubsystem(id: string, reason: string) {
  return run(() => post(`${subsystemPath(id)}/suspend`, { reason }));
}

export async function requestException(
  id: string,
  input: { username: string; role: string; reason: string },
) {
  return run(() => post(`${subsystemPath(id)}/exceptions`, input));
}

export async function decideException(
  id: string,
  exceptionId: string,
  decision: "approve" | "reject",
) {
  return run(() =>
    post(
      `${subsystemPath(id)}/exceptions/${encodeURIComponent(exceptionId)}/${decision}`,
    ),
  );
}

/* Change requests for the reviewed fields of an approved subsystem. */

export type ChangeRequestInput = {
  callbackUrl?: string;
  /** "" asks to remove the base URL. */
  baseUrl?: string;
  defaultRoleMapping?: Record<string, string>;
};

const changeRequestsPath = (id: string) => `${subsystemPath(id)}/change-requests`;

export async function createChangeRequest(id: string, input: ChangeRequestInput) {
  return run(() => post<ChangeRequest>(changeRequestsPath(id), input));
}

export async function decideChangeRequest(
  id: string,
  requestId: string,
  decision: "approve" | "reject",
  reason?: string,
) {
  return run(() =>
    post<ChangeRequest>(
      `${changeRequestsPath(id)}/${encodeURIComponent(requestId)}/${decision}`,
      decision === "reject" ? { reason } : undefined,
    ),
  );
}

export async function cancelChangeRequest(id: string, requestId: string) {
  return run(() =>
    post<ChangeRequest>(
      `${changeRequestsPath(id)}/${encodeURIComponent(requestId)}/cancel`,
    ),
  );
}
