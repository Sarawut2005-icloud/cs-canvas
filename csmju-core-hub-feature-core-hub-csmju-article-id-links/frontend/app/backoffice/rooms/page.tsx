import { redirect } from "next/navigation";

/** ห้องเรียนย้ายไปเป็นแท็บหนึ่งของหน้าข้อมูลอ้างอิง (B9) — path เดิมยังใช้ได้ */
export default function RoomsPage() {
  redirect("/backoffice/reference?tab=rooms");
}
