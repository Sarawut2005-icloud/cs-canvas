"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowBackIcon, LockIcon } from "../../components/icons";
import {
  FailureAlert,
  PasswordField,
  PasswordRules,
  meetsPasswordRules,
  type Failure,
} from "../PasswordFields";

export default function ChangePasswordForm({
  email,
  backHref,
}: {
  email: string;
  backHref: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [shown, setShown] = useState({ current: false, next: false, confirm: false });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const matches = next !== "" && next === confirm;
  const canSubmit = !pending && current !== "" && meetsPasswordRules(next) && matches;

  const toggle = (field: keyof typeof shown) =>
    setShown((state) => ({ ...state, [field]: !state[field] }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setFailure(null);

    let res: Response;
    try {
      res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
    } catch {
      setPending(false);
      return setFailure({ message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่" });
    }

    const body = (await res.json().catch(() => null)) as
      | { success: true }
      | { success: false; error?: Failure }
      | null;

    if (res.ok && body?.success) {
      // Every session is revoked and the cookies are gone. refresh() drops
      // the cached signed-in pages, as LogoutConfirm does.
      router.replace("/login?password=changed");
      router.refresh();
      return;
    }

    if (res.status === 401) {
      router.replace("/login");
      router.refresh();
      return;
    }

    setPending(false);
    const error = body && !body.success ? body.error : undefined;
    setFailure({
      message: error?.message ?? `เปลี่ยนรหัสผ่านไม่สำเร็จ (${res.status})`,
      details: error?.details,
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="fade-slide-up w-full max-w-md rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 shadow-sm">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <ArrowBackIcon className="h-4 w-4" />
          กลับ
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
            <LockIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-headline-md text-on-surface">เปลี่ยนรหัสผ่าน</h1>
            <p className="truncate text-body-md text-on-surface-variant" title={email}>
              {email}
            </p>
          </div>
        </div>

        <form className="mt-6 flex flex-col gap-5" onSubmit={submit} noValidate>
          {/* Lets password managers pair the new password with this account. */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />

          <PasswordField
            id="current-password"
            label="รหัสผ่านปัจจุบัน"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
            shown={shown.current}
            onToggle={() => toggle("current")}
          />
          <PasswordField
            id="new-password"
            label="รหัสผ่านใหม่"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            shown={shown.next}
            onToggle={() => toggle("next")}
          />

          <PasswordRules
            password={next}
            extra={["ไม่ซ้ำกับรหัสผ่านปัจจุบัน (ตรวจตอนบันทึก)"]}
          />

          <PasswordField
            id="confirm-password"
            label="ยืนยันรหัสผ่านใหม่"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            shown={shown.confirm}
            onToggle={() => toggle("confirm")}
          />
          {confirm !== "" && !matches && (
            <p className="-mt-3 text-label-md text-error">รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน</p>
          )}

          <p className="rounded-lg bg-surface px-4 py-3 text-body-md text-on-surface-variant">
            เปลี่ยนแล้วจะออกจากระบบทุกเครื่อง รวมเครื่องนี้ — ต้องเข้าสู่ระบบใหม่ด้วยรหัสผ่านใหม่
          </p>

          {failure && <FailureAlert failure={failure} />}

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-primary-container py-3 text-label-md text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
          </button>
        </form>
      </div>
    </main>
  );
}
