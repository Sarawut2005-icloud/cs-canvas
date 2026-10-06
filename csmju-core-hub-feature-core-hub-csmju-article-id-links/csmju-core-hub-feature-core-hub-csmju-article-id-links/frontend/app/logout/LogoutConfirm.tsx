"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckIcon, LockIcon } from "../components/icons";
import { logout } from "../lib/session";

export default function LogoutConfirm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  // Cancelling keeps the session; say so instead of silently leaving.
  const [cancelled, setCancelled] = useState(false);

  const confirm = async () => {
    if (pending) return;
    setPending(true);
    // POST /api/auth/logout revokes the session at the Core API and clears
    // the cookies even when that call fails, so /login is always next.
    const ssoSignOut = await logout().catch(() => null);
    if (ssoSignOut) {
      // MJU SSO session: finish the sign-out at sso.mju.ac.th too, the same
      // way PortalShell does.
      window.location.assign(ssoSignOut);
      return;
    }
    router.replace("/login");
    router.refresh();
  };

  if (cancelled) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="fade-slide-up w-full max-w-md rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckIcon className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-headline-md text-on-surface">
            คุณยังอยู่ในระบบ CSMJU2030
          </h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            ยกเลิกการออกจากระบบแล้ว กลับไปใช้งานระบบย่อยต่อได้ทันที
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Link
              href="/"
              className="rounded-lg bg-primary-container px-4 py-2.5 text-label-md text-white transition-opacity hover:opacity-90"
            >
              กลับหน้าหลัก
            </Link>
            <button
              type="button"
              onClick={() => setCancelled(false)}
              className="text-label-md text-on-surface-variant hover:underline"
            >
              เปลี่ยนใจ ต้องการออกจากระบบ
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="fade-slide-up w-full max-w-md rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
          <LockIcon className="h-6 w-6" />
        </span>

        <h1 className="mt-4 font-display text-headline-md text-on-surface">
          ออกจากระบบ CSMJU2030?
        </h1>

        <p className="mt-2 text-body-md text-on-surface">
          กดยืนยันเพื่อออกจาก CSMJU2030 และทุกระบบย่อย
        </p>
        <p className="mt-1 text-caption text-on-surface-variant">
          ระบบย่อยที่เปิดค้างไว้อาจใช้งานต่อได้อีกไม่เกิน 15 นาที หลังจากนั้นต้องเข้าสู่ระบบใหม่
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setCancelled(true)}
            disabled={pending}
            className="rounded-lg border border-outline-variant px-4 py-2.5 text-label-md text-on-surface-variant transition-colors hover:bg-surface-variant/50 disabled:opacity-40"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="rounded-lg bg-error px-4 py-2.5 text-label-md text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "กำลังออกจากระบบ…" : "ยืนยันออกจากระบบ"}
          </button>
        </div>
      </div>
    </main>
  );
}
