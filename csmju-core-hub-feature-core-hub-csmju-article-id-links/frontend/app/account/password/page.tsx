import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/api";
import { PASSWORD_SETUP_PATH } from "../../lib/password-setup";
import { homePathFor } from "../../lib/session";
import ChangePasswordForm from "./ChangePasswordForm";

export const metadata: Metadata = {
  title: "เปลี่ยนรหัสผ่าน · CSMJU",
};

/**
 * /account/password — one page for every role, reached from the button above
 * "ออกจากระบบ" in both the portal and the backoffice. It sits outside both
 * layouts so students and staff get the same page; "กลับ" leads each back to
 * their own home.
 */
export default async function ChangePasswordPage() {
  // proxy.ts already sends anonymous visitors to /login; this confirms the
  // session is still live at the Core API.
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/session-ended");
  // No current password to confirm — set one through MJU SSO instead.
  if (user.hasPassword === false) redirect(PASSWORD_SETUP_PATH);

  return <ChangePasswordForm email={user.email} backHref={homePathFor(user.role)} />;
}
