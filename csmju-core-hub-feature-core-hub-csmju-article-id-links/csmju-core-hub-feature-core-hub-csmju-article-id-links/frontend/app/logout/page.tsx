import type { Metadata } from "next";
import LogoutConfirm from "./LogoutConfirm";

export const metadata: Metadata = {
  title: "ออกจากระบบ · CSMJU",
};

/**
 * GET /logout — where a subsystem's POST /auth/logout sends the browser.
 *
 * Signing out of Core Hub signs the user out of every subsystem, so this page
 * only asks. Ending the session on the GET itself would let any other site
 * embed a link, or an <img>, and sign the user out without their say.
 * proxy.ts sends a visitor with no session straight to /login.
 */
export default function LogoutPage() {
  return <LogoutConfirm />;
}
