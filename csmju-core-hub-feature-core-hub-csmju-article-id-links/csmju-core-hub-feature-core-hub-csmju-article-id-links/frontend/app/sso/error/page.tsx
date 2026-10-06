import type { Metadata } from "next";
import Link from "next/link";
import { AppsIcon, ShieldIcon } from "../../components/icons";

export const metadata: Metadata = {
  title: "เข้าระบบย่อยไม่สำเร็จ · CSMJU",
};

/**
 * Where /sso/authorize lands when it cannot hand the user over.
 *
 * The query only names a code; every sentence shown is written here. Text
 * taken from the query would let anyone craft a link that puts their own
 * words on a Core Hub page.
 *
 * There is deliberately no way back to the subsystem from this page. The
 * subsystem would start another sign-in, Core Hub would refuse it for the
 * same reason, and the browser would bounce between the two forever.
 */

const MESSAGES: Record<string, string> = {
  forbidden: "บัญชีของคุณไม่มีสิทธิ์เข้าระบบนี้",
  not_found: "ไม่พบระบบนี้ในทะเบียนของ Core Hub",
  not_available: "ระบบนี้ยังไม่เปิดให้ใช้งาน",
  bad_request: "ลิงก์เข้าระบบไม่ถูกต้อง",
  unavailable: "ติดต่อ Core Hub ไม่ได้ชั่วคราว กรุณาลองใหม่",
};

const FALLBACK_MESSAGE = "เข้าระบบไม่สำเร็จ กรุณาลองใหม่";

/** Same rule /sso/authorize applies — anything else is not echoed back. */
const SUBSYSTEM_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default async function SsoErrorPage({
  searchParams,
}: PageProps<"/sso/error">) {
  const { code, subsystem } = await searchParams;

  const message =
    (typeof code === "string" && Object.hasOwn(MESSAGES, code)
      ? MESSAGES[code]
      : undefined) ?? FALLBACK_MESSAGE;

  const name =
    typeof subsystem === "string" &&
    subsystem.length <= 64 &&
    SUBSYSTEM_NAME.test(subsystem)
      ? subsystem
      : null;

  const Icon = code === "forbidden" ? ShieldIcon : AppsIcon;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="fade-slide-up w-full max-w-md rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
          <Icon className="h-6 w-6" />
        </span>

        <h1 className="mt-4 font-display text-headline-md text-on-surface">
          เข้าระบบย่อยไม่สำเร็จ
        </h1>

        <p className="mt-2 text-body-md text-on-surface-variant">{message}</p>

        {name && (
          <p className="mt-4 text-caption text-outline">
            ระบบ: <span className="font-mono">{name}</span>
          </p>
        )}

        <Link
          href="/"
          className="btn-gradient mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-label-md text-white shadow-md"
        >
          กลับหน้าแรกของ Core Hub
        </Link>
      </div>
    </main>
  );
}
