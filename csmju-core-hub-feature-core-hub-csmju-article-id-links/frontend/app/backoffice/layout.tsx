import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  getMyNotifications,
  getMyPerson,
  getMySchedule,
} from "../lib/api";
import { classReminder } from "../lib/schedule";
import { PASSWORD_SETUP_PATH } from "../lib/password-setup";
import { BACKOFFICE_ROLES } from "../lib/session";
import AccessDenied from "./_components/AccessDenied";
import BackofficeShell from "./BackofficeShell";

export const metadata: Metadata = {
  title: "CSMJU BackOffice - ระบบผู้ดูแล",
  description: "ระบบหลังบ้านสำหรับจัดการข้อมูลนักศึกษา บุคลากร และประกาศ",
};

export default async function BackofficeLayout({
  children,
}: LayoutProps<"/backoffice">) {
  const user = await getCurrentUser();

  if (!user) {
    // The cookie looks signed in but the session is gone; clear it there.
    redirect("/api/auth/session-ended");
  }

  // An MJU SSO account sets its password before anything else (UX only —
  // skipping it just leaves the account without a password).
  if (user.hasPassword === false) redirect(PASSWORD_SETUP_PATH);

  // Other roles see why they cannot use it (ui-design-system §9.3
  // FORBIDDEN) rather than being sent elsewhere; the API gates the data.
  if (!BACKOFFICE_ROLES.includes(user.role)) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg">
          <AccessDenied
            requirement="ระบบหลังบ้านใช้ได้เฉพาะเจ้าหน้าที่ อาจารย์ และผู้ดูแลระบบ"
            backHref="/"
            backLabel="กลับหน้าหลัก"
          />
        </div>
      </main>
    );
  }

  // รายการระบบย่อยไม่อยู่ใต้เมนูหลังบ้านแล้ว (handoff 2.1) — เข้าได้จากพอร์ทัล
  const [person, notifications, schedule] = await Promise.all([
    getMyPerson(),
    getMyNotifications(),
    getMySchedule(),
  ]);

  return (
    <BackofficeShell
      user={user}
      person={person}
      notifications={notifications}
      reminder={classReminder(schedule ?? [])}
    >
      {children}
    </BackofficeShell>
  );
}
