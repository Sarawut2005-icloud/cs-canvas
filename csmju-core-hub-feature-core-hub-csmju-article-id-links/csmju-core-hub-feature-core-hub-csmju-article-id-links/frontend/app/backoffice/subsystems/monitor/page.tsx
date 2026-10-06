import type { Metadata } from "next";
import { listSubsystems } from "../../../lib/api";
import PageHeader from "../../_components/PageHeader";
import { ErrorState } from "../_components/StateViews";
import MonitorTable from "./MonitorTable";

export const metadata: Metadata = {
  title: "Monitor ระบบย่อย · BackOffice · CSMJU",
};

/**
 * On-demand health of every subsystem the caller may see (the API scopes
 * staff to their own entries). Probing happens client-side one row at a
 * time through a server action, so the page renders before any check runs.
 */
export default async function MonitorPage() {
  let subsystems;
  try {
    subsystems = (await listSubsystems({ limit: 100 })).data;
  } catch (error) {
    return <ErrorState error={error} />;
  }

  return (
    <>
      <PageHeader
        title="Monitor ระบบย่อย"
        description="ตรวจว่าระบบย่อยแต่ละตัวตอบ /api/health หรือไม่ ใช้เวลาเท่าไร และเช็กล่าสุดเมื่อไร · ตรวจเมื่อเปิดหน้าหรือกดปุ่ม ยังไม่มีการตรวจเบื้องหลัง"
      />
      <MonitorTable subsystems={subsystems} />
    </>
  );
}
