import { redirect } from "next/navigation";

/**
 * นำเข้า CSV ย้ายไปเป็นปุ่มเปิด popup ในหน้านักศึกษาและหน้าบุคลากร
 * (BACKOFFICE_DATA handoff 2.2) — path เดิมยังพาไปหน้านักศึกษา
 */
export default function ImportPeoplePage() {
  redirect("/backoffice/students");
}
