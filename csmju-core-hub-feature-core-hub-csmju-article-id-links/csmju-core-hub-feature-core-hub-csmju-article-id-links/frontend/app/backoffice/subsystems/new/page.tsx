import type { Metadata } from "next";
import Link from "next/link";
import { ArrowBackIcon } from "../../../components/icons";
import { getCurrentUser, getStandardsVersions } from "../../../lib/api";
import { capabilitiesFor } from "../../../lib/subsystems";
import AccessDenied from "../../_components/AccessDenied";
import PageHeader from "../../_components/PageHeader";
import SubsystemForm from "../_components/SubsystemForm";

export const metadata: Metadata = {
  title: "ส่งคำขอขึ้นระบบ · BackOffice · CSMJU",
};

export default async function NewSubsystemPage() {
  const user = await getCurrentUser();
  // Registering is for admins and the accounts granted subsystem:create —
  // the Core API answers 403 otherwise; this only says so up front.
  const caps = capabilitiesFor(user?.role ?? "staff", user?.permissions);
  const standardsVersions = caps.create ? await getStandardsVersions() : [];

  return (
    <>
      <Link
        href="/backoffice/subsystems"
        className="fade-slide-up inline-flex items-center gap-2 self-start text-label-md text-on-surface-variant hover:text-on-surface"
      >
        <ArrowBackIcon className="h-4 w-4" />
        ระบบย่อย
      </Link>
      <PageHeader
        title="ส่งคำขอขึ้นระบบ"
        description="ลงทะเบียนระบบย่อยกับ Core Hub · ผู้ดูแลระบบจะตรวจและอนุมัติก่อนเปิดให้ผู้ใช้เข้าผ่าน SSO"
      />
      {caps.create ? (
        <SubsystemForm standardsVersions={standardsVersions} />
      ) : (
        <AccessDenied />
      )}
    </>
  );
}
