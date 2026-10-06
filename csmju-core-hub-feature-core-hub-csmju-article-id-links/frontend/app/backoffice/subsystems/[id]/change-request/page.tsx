import type { Metadata } from "next";
import Link from "next/link";
import { ArrowBackIcon } from "../../../../components/icons";
import { getCurrentUser, getSubsystem, type SubsystemDetail } from "../../../../lib/api";
import PageHeader from "../../../_components/PageHeader";
import ChangeRequestForm from "../../_components/ChangeRequestForm";
import { EmptyState, ErrorState } from "../../_components/StateViews";

export const metadata: Metadata = {
  title: "ขอแก้ไขระบบย่อย · BackOffice · CSMJU",
};

/**
 * /backoffice/subsystems/[id]/change-request — the owner of an approved
 * subsystem asks to change its callback URL, base URL or role mapping. The
 * Core API decides who may (owner, one pending request at a time); this
 * page only explains when the form is not the way.
 */
export default async function ChangeRequestPage({
  params,
}: PageProps<"/backoffice/subsystems/[id]/change-request">) {
  const { id } = await params;
  const user = await getCurrentUser();

  let subsystem: SubsystemDetail;
  try {
    subsystem = await getSubsystem(id);
  } catch (error) {
    return <ErrorState error={error} />;
  }

  const detailHref = `/backoffice/subsystems/${encodeURIComponent(subsystem.id)}`;
  const blocker =
    subsystem.approvalStatus !== "APPROVED"
      ? "ระบบนี้ยังไม่อนุมัติ — แก้ข้อมูลได้โดยตรงที่ปุ่ม \"แก้ไข\""
      : subsystem.ownerId !== user?.id
        ? "ยื่นคำขอแก้ไขได้เฉพาะเจ้าของระบบ"
        : subsystem.pendingChangeRequest
          ? "มีคำขอแก้ไขรออนุมัติอยู่แล้ว — รอผลหรือยกเลิกคำขอเดิมในหน้ารายละเอียดก่อน"
          : null;

  return (
    <>
      <Link
        href={detailHref}
        className="fade-slide-up inline-flex items-center gap-2 self-start text-label-md text-on-surface-variant hover:text-on-surface"
      >
        <ArrowBackIcon className="h-4 w-4" />
        {subsystem.displayName}
      </Link>
      <PageHeader
        title="ขอแก้ไขระบบย่อย"
        description="แก้ callback URL · base URL · การแมปบทบาท ของระบบที่อนุมัติแล้ว · ผู้ดูแลระบบอนุมัติแล้วค่าใหม่ทุกช่องมีผลพร้อมกัน ระหว่างรอระบบยังใช้ค่าเดิม · ชื่อระบบไม่เปลี่ยน"
      />
      {blocker ? (
        <EmptyState title="ยื่นคำขอแก้ไขไม่ได้" description={blocker} />
      ) : (
        <ChangeRequestForm subsystem={subsystem} />
      )}
    </>
  );
}
