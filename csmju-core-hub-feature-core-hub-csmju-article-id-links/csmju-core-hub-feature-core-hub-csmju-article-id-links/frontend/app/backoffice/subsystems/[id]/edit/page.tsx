import type { Metadata } from "next";
import Link from "next/link";
import { ArrowBackIcon } from "../../../../components/icons";
import {
  getCurrentUser,
  getStandardsVersions,
  getSubsystem,
  type SubsystemDetail,
} from "../../../../lib/api";
import { capabilitiesFor } from "../../../../lib/subsystems";
import PageHeader from "../../../_components/PageHeader";
import SubsystemForm from "../../_components/SubsystemForm";
import { ErrorState } from "../../_components/StateViews";

export const metadata: Metadata = {
  title: "แก้ไขระบบย่อย · BackOffice · CSMJU",
};

export default async function EditSubsystemPage({
  params,
}: PageProps<"/backoffice/subsystems/[id]/edit">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const caps = capabilitiesFor(user?.role ?? "staff", user?.permissions);

  let subsystem: SubsystemDetail;
  try {
    subsystem = await getSubsystem(id);
  } catch (error) {
    return <ErrorState error={error} />;
  }
  const standardsVersions = await getStandardsVersions();

  const lockReviewedFields =
    subsystem.approvalStatus === "APPROVED" && !caps.editReviewedFields;

  return (
    <>
      <Link
        href={`/backoffice/subsystems/${encodeURIComponent(subsystem.id)}`}
        className="fade-slide-up inline-flex items-center gap-2 self-start text-label-md text-on-surface-variant hover:text-on-surface"
      >
        <ArrowBackIcon className="h-4 w-4" />
        {subsystem.displayName}
      </Link>
      <PageHeader
        title="แก้ไขระบบย่อย"
        description={
          lockReviewedFields
            ? "ระบบนี้อนุมัติแล้ว แก้ได้ทันทีเฉพาะชื่อที่แสดง หมวด คำอธิบาย repository และเวอร์ชันมาตรฐาน · callback URL base URL และการแมปบทบาท ใช้ปุ่ม \"ขอแก้ไข\" ในหน้ารายละเอียด · เปลี่ยนชื่อระบบได้เฉพาะผู้ดูแลระบบ"
            : "แก้ไขข้อมูลการลงทะเบียนของระบบย่อย"
        }
      />
      <SubsystemForm
        subsystem={subsystem}
        lockReviewedFields={lockReviewedFields}
        standardsVersions={standardsVersions}
        renameWarning={
          subsystem.approvalStatus === "APPROVED" && caps.editReviewedFields
        }
        canSetListing={caps.editReviewedFields}
      />
    </>
  );
}
