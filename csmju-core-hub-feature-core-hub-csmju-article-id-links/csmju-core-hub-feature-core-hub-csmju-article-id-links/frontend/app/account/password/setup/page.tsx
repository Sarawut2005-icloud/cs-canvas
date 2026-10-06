import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/api";
import { afterPasswordSetup } from "../../../lib/password-setup";
import { homePathFor } from "../../../lib/session";
import SetupPasswordForm from "./SetupPasswordForm";

export const metadata: Metadata = {
  title: "ตั้งรหัสผ่าน · CSMJU",
};

/**
 * /account/password/setup[?reset=1][&next=<path>] — sets a Core Hub password
 * without asking for the current one (POST /auth/password/set):
 *
 *  - the first password of an MJU SSO account — /auth/mju/signin and the
 *    portal/backoffice layouts send an account without one here;
 *  - "ลืมรหัสผ่าน" (`reset=1`) — the login page sends the user through MJU
 *    SSO first; the Core API accepts it only within 10 minutes of that.
 *
 * Outside both layouts on purpose: they redirect here, and the page must
 * render for every role.
 */
export default async function SetupPasswordPage({
  searchParams,
}: PageProps<"/account/password/setup">) {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/session-ended");

  const { next, reset } = await searchParams;

  return (
    <SetupPasswordForm
      email={user.email}
      hasPassword={user.hasPassword !== false}
      reset={reset === "1"}
      next={afterPasswordSetup(next)}
      homeHref={homePathFor(user.role)}
    />
  );
}
