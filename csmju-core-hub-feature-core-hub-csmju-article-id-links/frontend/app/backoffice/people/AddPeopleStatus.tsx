"use client";

import { CheckIcon } from "../../components/icons";
import { formatNumber } from "../../lib/format";
import type { ApiFailure } from "./import-client";
import { formMessage, type AddPhase } from "./useAddPeople";

/**
 * What the add forms show above their buttons: the API failure, the clean
 * dry-run summary waiting for confirmation, or the saved result.
 */
export default function AddPeopleStatus({
  state,
  failure,
  issueCount,
}: {
  state: AddPhase;
  failure: ApiFailure | null;
  issueCount: number;
}) {
  if (failure) {
    return (
      <div role="alert" className="space-y-1 rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
        <p>{formMessage(failure.message)}</p>
        {failure.details && failure.details.length > 0 && (
          <ul className="list-inside list-disc text-body-md">
            {failure.details.map((detail, index) => (
              <li key={index}>{formMessage(detail)}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (issueCount > 0) {
    return (
      <p role="alert" className="rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
        พบข้อผิดพลาด {formatNumber(issueCount)} แถว — แก้ตามข้อความใต้แต่ละแถว แล้วกดตรวจสอบอีกครั้ง
      </p>
    );
  }

  if (state.phase === "checked" || state.phase === "committing") {
    const { preview } = state;
    return (
      <p role="status" className="flex flex-wrap items-center gap-x-2 rounded-lg bg-success/10 px-4 py-3 text-label-md text-emerald-700">
        <CheckIcon className="h-4 w-4" />
        ข้อมูลถูกต้อง พร้อมบันทึก {formatNumber(preview.toCreate)} คน
        {preview.usersToCreate > 0 &&
          ` · จะสร้างบัญชีผู้ใช้อัตโนมัติ ${formatNumber(preview.usersToCreate)} บัญชี (เข้าครั้งแรกด้วย MJU SSO แล้วตั้งรหัสผ่านเอง)`}
      </p>
    );
  }

  if (state.phase === "done") {
    const { outcome } = state;
    return (
      <p role="status" className="flex flex-wrap items-center gap-x-2 rounded-lg bg-success/10 px-4 py-3 text-label-md text-emerald-700">
        <CheckIcon className="h-4 w-4" />
        บันทึกแล้ว {formatNumber(outcome.created)} คน
        {outcome.usersCreated > 0 && ` · สร้างบัญชีผู้ใช้ ${formatNumber(outcome.usersCreated)} บัญชี`}
      </p>
    );
  }

  return null;
}
