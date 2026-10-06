"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChangeRequest, Subsystem } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import { FIELD_LABELS, formatFieldValue } from "../../../lib/subsystems";
import { primaryButtonClass, secondaryButtonClass } from "../../_components/ui";
import { cancelChangeRequest, decideChangeRequest } from "../actions";
import ActionDialog from "./ActionDialog";

const outlineDangerClass =
  "rounded-lg border border-error px-3 py-2 text-label-md text-error transition-colors hover:bg-error-container/40";

type Dialog = "approve" | "reject" | "cancel" | null;

/** Current value → requested value, one row per requested field. */
export function RequestedChanges({
  request,
  current,
}: {
  request: Pick<ChangeRequest, "changes">;
  current: Pick<Subsystem, "callbackUrl" | "baseUrl" | "defaultRoleMapping">;
}) {
  return (
    <dl className="mt-3 space-y-2">
      {Object.entries(request.changes).map(([field, to]) => (
        <div key={field} className="text-body-md">
          <dt className="text-label-md">{FIELD_LABELS[field] ?? field}</dt>
          <dd className="break-all">
            <span className="line-through opacity-70">
              {formatFieldValue(current[field as keyof typeof current])}
            </span>{" "}
            → <strong>{formatFieldValue(to)}</strong>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Change requests on the detail page of an approved subsystem (handoff 2.2):
 * the owner asks ("ขอแก้ไข") or withdraws; an administrator approves — all
 * fields at once — or rejects with a reason. Until then SSO keeps the
 * current values, which the banner says plainly.
 */
export default function ChangeRequestPanel({
  subsystem,
  pending,
  isOwner,
  canReview,
}: {
  subsystem: Pick<
    Subsystem,
    "id" | "callbackUrl" | "baseUrl" | "defaultRoleMapping"
  >;
  pending: ChangeRequest | null;
  isOwner: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);

  if (!pending) {
    if (!isOwner) return null;
    return (
      <div className="fade-slide-up flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-5 py-4">
        <p className="text-body-md text-on-surface-variant">
          ระบบนี้อนุมัติแล้ว — callback URL · base URL · การแมปบทบาท เปลี่ยนผ่านคำขอแก้ไขที่ผู้ดูแลระบบอนุมัติ
          (ไม่ต้องลงทะเบียนใหม่)
        </p>
        <Link
          href={`/backoffice/subsystems/${encodeURIComponent(subsystem.id)}/change-request`}
          className={secondaryButtonClass}
        >
          ขอแก้ไข
        </Link>
      </div>
    );
  }

  const done = () => {
    setDialog(null);
    router.refresh();
  };

  return (
    <div
      role="note"
      className="fade-slide-up rounded-xl border border-amber-300 bg-amber-100 px-5 py-4 text-amber-800"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label-md">มีคำขอแก้ไขรออนุมัติ</p>
          <p className="mt-1 text-body-md">
            ยื่นโดย {pending.requestedBy.username ?? pending.requestedBy.email} ·{" "}
            <time dateTime={pending.createdAt}>{formatDateTime(pending.createdAt)}</time> ·
            ระหว่างรอ SSO ยังใช้ค่าปัจจุบัน
          </p>
        </div>
        <div className="flex gap-2">
          {canReview && (
            <>
              <button
                type="button"
                onClick={() => setDialog("reject")}
                className={outlineDangerClass}
              >
                ปฏิเสธ
              </button>
              <button
                type="button"
                onClick={() => setDialog("approve")}
                className={`${primaryButtonClass} px-3 py-2`}
              >
                อนุมัติ
              </button>
            </>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={() => setDialog("cancel")}
              className={secondaryButtonClass}
            >
              ยกเลิกคำขอ
            </button>
          )}
        </div>
      </div>
      <RequestedChanges request={pending} current={subsystem} />

      {dialog === "approve" && (
        <ActionDialog
          title="อนุมัติคำขอแก้ไข"
          description="ค่าใหม่ทุกช่องมีผลทันที — /sso/authorize จะพาผู้ใช้ไปที่ callback ใหม่ตั้งแต่ครั้งถัดไป"
          confirmLabel="อนุมัติ"
          onConfirm={() => decideChangeRequest(subsystem.id, pending.id, "approve")}
          onClose={() => setDialog(null)}
          onDone={done}
        >
          <RequestedChanges request={pending} current={subsystem} />
        </ActionDialog>
      )}
      {dialog === "reject" && (
        <ActionDialog
          title="ปฏิเสธคำขอแก้ไข"
          description="ค่าในทะเบียนไม่เปลี่ยน · เหตุผลจะแสดงให้เจ้าของระบบเห็นในประวัติ"
          confirmLabel="ปฏิเสธ"
          tone="danger"
          reason="required"
          onConfirm={(reason) =>
            decideChangeRequest(subsystem.id, pending.id, "reject", reason)
          }
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog === "cancel" && (
        <ActionDialog
          title="ยกเลิกคำขอแก้ไข"
          description="คำขอนี้จะถูกยกเลิก ค่าในทะเบียนไม่เปลี่ยน · ยื่นคำขอใหม่ได้ภายหลัง"
          confirmLabel="ยกเลิกคำขอ"
          tone="danger"
          onConfirm={() => cancelChangeRequest(subsystem.id, pending.id)}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
    </div>
  );
}
