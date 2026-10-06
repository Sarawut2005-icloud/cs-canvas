import { redirect } from "next/navigation";
import {
  getCurrentUser,
  getLinkedSubsystems,
  getMyNotifications,
  getMyPerson,
  getMySchedule,
} from "../lib/api";
import { classReminder } from "../lib/schedule";
import { PASSWORD_SETUP_PATH } from "../lib/password-setup";
import PortalShell from "./PortalShell";

export default async function PortalLayout({ children }: LayoutProps<"/">) {
  // Verified against GET /auth/me — the proxy only checks the cookie,
  // the backend confirms the session is still active.
  const user = await getCurrentUser();

  if (!user) {
    // The cookie looks signed in but the session is gone; clear it there.
    redirect("/api/auth/session-ended");
  }

  // An MJU SSO account sets its password before anything else (UX only —
  // skipping it just leaves the account without a password).
  if (user.hasPassword === false) redirect(PASSWORD_SETUP_PATH);

  // Timetables belong to subsystems (PM 2026-10-05): only those who teach
  // get a class reminder in the bell.
  const teaches = user.role !== "student" && user.role !== "alumni";

  // อ่านจาก Subsystem Registry จริง — เมนูระบบย่อยไม่ได้ฮาร์ดโค้ดไว้
  const [subsystems, person, notifications, schedule] = await Promise.all([
    getLinkedSubsystems(),
    getMyPerson(),
    getMyNotifications(),
    teaches ? getMySchedule() : Promise.resolve([]),
  ]);

  return (
    <PortalShell
      user={user}
      person={person}
      subsystems={subsystems}
      notifications={notifications}
      reminder={classReminder(schedule ?? [])}
    >
      {children}
    </PortalShell>
  );
}
