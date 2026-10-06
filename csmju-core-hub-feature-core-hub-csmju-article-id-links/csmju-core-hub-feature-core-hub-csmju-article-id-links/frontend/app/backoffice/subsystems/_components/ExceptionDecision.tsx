"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { decideException } from "../actions";
import { primaryButtonClass } from "../../_components/ui";
import ActionDialog from "./ActionDialog";

const outlineDangerClass =
  "rounded-lg border border-error px-3 py-2 text-label-md text-error transition-colors hover:bg-error-container/40";

/** Approve / reject one exception request (admin). */
export default function ExceptionDecision({
  subsystemId,
  exceptionId,
  username,
  role,
}: {
  subsystemId: string;
  exceptionId: string;
  username: string;
  role: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);

  const who = (
    <>
      <strong className="text-on-surface">{username}</strong> ในบทบาท{" "}
      <strong className="text-on-surface">{role}</strong>
    </>
  );

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => setDialog("reject")}
        className={outlineDangerClass}
        aria-label={`ปฏิเสธสิทธิ์พิเศษของ ${username}`}
      >
        ปฏิเสธ
      </button>
      <button
        type="button"
        onClick={() => setDialog("approve")}
        className={`${primaryButtonClass} px-3 py-2`}
        aria-label={`อนุมัติสิทธิ์พิเศษของ ${username}`}
      >
        อนุมัติ
      </button>

      {dialog && (
        <ActionDialog
          title={dialog === "approve" ? "อนุมัติสิทธิ์พิเศษ" : "ปฏิเสธสิทธิ์พิเศษ"}
          description={
            dialog === "approve" ? (
              <>ให้ {who} ในระบบย่อยนี้</>
            ) : (
              <>ไม่ให้ {who} ในระบบย่อยนี้</>
            )
          }
          confirmLabel={dialog === "approve" ? "อนุมัติ" : "ปฏิเสธ"}
          tone={dialog === "approve" ? "primary" : "danger"}
          onConfirm={() => decideException(subsystemId, exceptionId, dialog)}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
