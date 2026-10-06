"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Subsystem } from "../../../lib/api";
import type { SubsystemCapabilities } from "../../../lib/subsystems";
import {
  activateSubsystem,
  approveSubsystem,
  deactivateSubsystem,
  deleteSubsystem,
  rejectSubsystem,
  resubmitSubsystem,
  suspendSubsystem,
} from "../actions";
import { EditIcon } from "../../../components/icons";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "../../_components/ui";
import ActionDialog from "./ActionDialog";

type Dialog =
  | "approve"
  | "reject"
  | "resubmit"
  | "activate"
  | "deactivate"
  | "suspend"
  | "delete"
  | null;

const outlineDangerClass =
  "rounded-lg border border-error px-4 py-2.5 text-label-md text-error transition-colors hover:bg-error-container/40 disabled:cursor-not-allowed disabled:opacity-40";

const TOKEN_NOTE =
  "ผู้ใช้จะเข้าระบบนี้ผ่าน SSO ไม่ได้ทันที แต่ผู้ที่เข้าไปแล้วยังใช้งานต่อได้จนกว่า token จะหมดอายุ (สูงสุด 15 นาที)";

/** Buttons offered on the detail page — only what this role may do now. */
export default function SubsystemActions({
  subsystem,
  caps,
  canEdit,
}: {
  subsystem: Pick<
    Subsystem,
    "id" | "name" | "displayName" | "approvalStatus" | "status"
  >;
  caps: SubsystemCapabilities;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [activateNow, setActivateNow] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const { id, displayName, approvalStatus, status } = subsystem;
  const approved = approvalStatus === "APPROVED";
  const close = () => setDialog(null);
  const done = (message: string) => () => {
    setDialog(null);
    setNotice(message);
    router.refresh();
  };

  const name = <strong className="text-on-surface">{displayName}</strong>;

  return (
    <div className="flex flex-col items-start gap-3 md:items-end">
      <div className="flex flex-wrap gap-2 md:justify-end">
        {canEdit && (
          <Link
            href={`/backoffice/subsystems/${encodeURIComponent(id)}/edit`}
            className={`${secondaryButtonClass} inline-flex items-center gap-2`}
          >
            <EditIcon className="h-4 w-4" />
            แก้ไข
          </Link>
        )}

        {caps.review && approvalStatus === "PENDING" && (
          <>
            <button type="button" onClick={() => setDialog("reject")} className={outlineDangerClass}>
              ปฏิเสธ
            </button>
            <button type="button" onClick={() => setDialog("approve")} className={primaryButtonClass}>
              อนุมัติ
            </button>
          </>
        )}

        {canEdit && approvalStatus === "REJECTED" && (
          <button type="button" onClick={() => setDialog("resubmit")} className={primaryButtonClass}>
            ส่งคำขออีกครั้ง
          </button>
        )}

        {caps.operate && approved && status !== "ACTIVE" && (
          <button type="button" onClick={() => setDialog("activate")} className={primaryButtonClass}>
            เปิดใช้งาน
          </button>
        )}

        {caps.operate && approved && status === "ACTIVE" && (
          <>
            <button type="button" onClick={() => setDialog("deactivate")} className={secondaryButtonClass}>
              ปิดใช้งาน
            </button>
            <button type="button" onClick={() => setDialog("suspend")} className={outlineDangerClass}>
              ระงับ
            </button>
          </>
        )}

        {caps.remove && (
          <button
            type="button"
            onClick={() => setDialog("delete")}
            disabled={status === "ACTIVE"}
            aria-describedby={status === "ACTIVE" ? `${id}-delete-reason` : undefined}
            title={status === "ACTIVE" ? "ต้องปิดใช้งานระบบก่อนจึงจะลบได้" : undefined}
            className={outlineDangerClass}
          >
            ลบ
          </button>
        )}
      </div>

      {caps.remove && status === "ACTIVE" && (
        <p id={`${id}-delete-reason`} className="text-label-sm text-on-surface-variant">
          ลบได้หลังปิดใช้งานระบบแล้ว
        </p>
      )}

      {notice && (
        <p role="status" className="text-label-md text-primary-container">
          {notice}
        </p>
      )}

      {dialog === "approve" && (
        <ActionDialog
          title="อนุมัติคำขอขึ้นระบบ"
          description={<>อนุมัติ {name} ให้เชื่อมต่อกับ Core Hub</>}
          confirmLabel="อนุมัติ"
          onConfirm={() => approveSubsystem(id, activateNow)}
          onClose={close}
          onDone={done(activateNow ? "อนุมัติและเปิดใช้งานแล้ว" : "อนุมัติแล้ว")}
        >
          <div className="custom-checkbox flex items-center gap-3">
            <input
              id={`${id}-activate-now`}
              type="checkbox"
              checked={activateNow}
              onChange={(event) => setActivateNow(event.target.checked)}
            />
            <label htmlFor={`${id}-activate-now`} className="cursor-pointer select-none text-body-md text-on-surface">
              เปิดใช้งานทันทีหลังอนุมัติ
            </label>
          </div>
        </ActionDialog>
      )}

      {dialog === "reject" && (
        <ActionDialog
          title="ปฏิเสธคำขอขึ้นระบบ"
          description={<>เจ้าของระบบจะเห็นเหตุผลนี้ และแก้ไขแล้วส่งคำขอ {name} อีกครั้งได้</>}
          confirmLabel="ปฏิเสธคำขอ"
          tone="danger"
          reason="required"
          reasonLabel="เหตุผลที่ปฏิเสธ"
          onConfirm={(reason) => rejectSubsystem(id, reason)}
          onClose={close}
          onDone={done("ปฏิเสธคำขอแล้ว")}
        />
      )}

      {dialog === "resubmit" && (
        <ActionDialog
          title="ส่งคำขออีกครั้ง"
          description={<>ส่ง {name} กลับเข้าคิวให้ผู้ดูแลระบบพิจารณาอีกครั้ง ตรวจว่าแก้ไขตามเหตุผลที่ถูกปฏิเสธแล้ว</>}
          confirmLabel="ส่งคำขอ"
          onConfirm={() => resubmitSubsystem(id)}
          onClose={close}
          onDone={done("ส่งคำขออีกครั้งแล้ว")}
        />
      )}

      {dialog === "activate" && (
        <ActionDialog
          title="เปิดใช้งานระบบ"
          description={<>ผู้ใช้ที่มีบทบาทตามการแมปบทบาทจะเข้า {name} ผ่าน SSO ได้ทันที</>}
          confirmLabel="เปิดใช้งาน"
          onConfirm={() => activateSubsystem(id)}
          onClose={close}
          onDone={done("เปิดใช้งานแล้ว")}
        />
      )}

      {dialog === "deactivate" && (
        <ActionDialog
          title="ปิดใช้งานระบบ"
          description={<>ปิด {name} ตามปกติ เช่น ปิดปรับปรุง {TOKEN_NOTE}</>}
          confirmLabel="ปิดใช้งาน"
          reason="optional"
          onConfirm={(reason) => deactivateSubsystem(id, reason)}
          onClose={close}
          onDone={done("ปิดใช้งานแล้ว")}
        />
      )}

      {dialog === "suspend" && (
        <ActionDialog
          title="ระงับระบบ"
          description={<>ระงับ {name} เพราะมีปัญหา เช่น ละเมิดมาตรฐานหรือความปลอดภัย {TOKEN_NOTE}</>}
          confirmLabel="ระงับระบบ"
          tone="danger"
          reason="required"
          reasonLabel="เหตุผลที่ระงับ"
          onConfirm={(reason) => suspendSubsystem(id, reason)}
          onClose={close}
          onDone={done("ระงับระบบแล้ว")}
        />
      )}

      {dialog === "delete" && (
        <ActionDialog
          title={`ลบระบบย่อย "${displayName}"?`}
          description="ทะเบียน คำขอสิทธิ์พิเศษ และประวัติทั้งหมดของระบบนี้จะถูกลบถาวร"
          confirmLabel="ลบระบบย่อย"
          tone="danger"
          onConfirm={() => deleteSubsystem(id)}
          onClose={close}
          onDone={() => {
            setDialog(null);
            router.push("/backoffice/subsystems");
          }}
        />
      )}
    </div>
  );
}
