"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowBackIcon, LockIcon } from "../../../components/icons";
import { mjuReauthUrl } from "../../../lib/password-setup";
import {
  FailureAlert,
  PasswordField,
  PasswordRules,
  meetsPasswordRules,
  type Failure,
} from "../../PasswordFields";

type State = "form" | "reauth";

/** Full navigation: `next` may be /sso/authorize, a route handler that leaves the site. */
function go(path: string) {
  window.location.assign(path);
}

export default function SetupPasswordForm({
  email,
  hasPassword,
  reset,
  next,
  homeHref,
}: {
  email: string;
  /** false: first password of an MJU SSO account — the user cannot skip it. */
  hasPassword: boolean;
  reset: boolean;
  next: string | null;
  homeHref: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [shown, setShown] = useState({ password: false, confirm: false });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [state, setState] = useState<State>("form");

  const destination = next ?? homeHref;
  const matches = password !== "" && password === confirm;
  const canSubmit = !pending && meetsPasswordRules(password) && matches;
  const first = !hasPassword;

  const toggle = (field: keyof typeof shown) =>
    setShown((s) => ({ ...s, [field]: !s[field] }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setFailure(null);

    let res: Response;
    try {
      res = await fetch("/api/auth/password/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      });
    } catch {
      setPending(false);
      return setFailure({ message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่" });
    }

    const body = (await res.json().catch(() => null)) as
      | { success: true }
      | { success: false; error?: Failure }
      | null;

    // This session stays signed in: straight on to where the user was going.
    if (res.ok && body?.success) return go(destination);
    if (res.status === 401) return go("/login");
    setPending(false);
    // More than 10 minutes since the MJU sign-in: confirm with MJU again.
    if (res.status === 403) return setState("reauth");

    const error = body && !body.success ? body.error : undefined;
    setFailure({
      message: error?.message ?? `ตั้งรหัสผ่านไม่สำเร็จ (${res.status})`,
      details: error?.details,
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="fade-slide-up w-full max-w-md rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 shadow-sm">
        {!first && (
          <Link
            href={homeHref}
            className="inline-flex items-center gap-1.5 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <ArrowBackIcon className="h-4 w-4" />
            กลับ
          </Link>
        )}

        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
            <LockIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-headline-md text-on-surface">
              {first ? "ตั้งรหัสผ่าน CSMJU2030" : "ตั้งรหัสผ่านใหม่"}
            </h1>
            <p className="text-body-md text-on-surface-variant">
              {first
                ? "ครั้งแรกหลังเข้าสู่ระบบด้วย MJU SSO"
                : "ภายใน 10 นาทีหลังยืนยันตัวตนด้วย MJU SSO"}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-surface px-4 py-3 text-body-md text-on-surface-variant">
          <p>ครั้งต่อไปเข้าสู่ระบบได้ทั้งด้วย MJU SSO และด้วยอีเมลกับรหัสผ่านนี้</p>
          <p className="mt-2 text-label-md text-on-surface">อีเมลที่ใช้เข้าสู่ระบบ</p>
          <p className="break-all font-medium text-on-surface">{email}</p>
        </div>

        {state === "reauth" && (
          <div className="mt-6 flex flex-col gap-4">
            <p role="alert" className="rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
              ตั้งรหัสผ่านใหม่โดยไม่ใช้รหัสเดิมได้ภายใน 10 นาทีหลังเข้าสู่ระบบด้วย MJU SSO — กรุณายืนยันตัวตนอีกครั้ง
            </p>
            <a
              href={mjuReauthUrl(next)}
              className="rounded-lg bg-primary-container py-3 text-center text-label-md text-white transition-opacity hover:opacity-90"
            >
              ยืนยันตัวตนด้วย MJU SSO อีกครั้ง
            </a>
            <Link
              href="/account/password"
              className="text-center text-label-md text-primary-container hover:underline"
            >
              จำรหัสเดิมได้ — เปลี่ยนรหัสผ่านด้วยรหัสเดิม
            </Link>
          </div>
        )}

        {state === "form" && (
          <form className="mt-6 flex flex-col gap-5" onSubmit={submit} noValidate>
            {/* Lets password managers save the new password for this account. */}
            <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />

            <PasswordField
              id="new-password"
              label={first ? "รหัสผ่าน" : "รหัสผ่านใหม่"}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              shown={shown.password}
              onToggle={() => toggle("password")}
            />
            <PasswordRules password={password} />
            <PasswordField
              id="confirm-password"
              label="ยืนยันรหัสผ่าน"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              shown={shown.confirm}
              onToggle={() => toggle("confirm")}
            />
            {confirm !== "" && !matches && (
              <p className="-mt-3 text-label-md text-error">รหัสผ่านทั้งสองช่องไม่ตรงกัน</p>
            )}

            {hasPassword && (
              <p className="rounded-lg bg-surface px-4 py-3 text-body-md text-on-surface-variant">
                {reset ? "ไม่ต้องใช้รหัสเดิม · " : ""}ตั้งแล้วจะออกจากระบบเครื่องอื่นทั้งหมด เครื่องนี้ยังใช้งานต่อได้
              </p>
            )}

            {failure && <FailureAlert failure={failure} />}

            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-primary-container py-3 text-label-md text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "กำลังบันทึก…" : "ตั้งรหัสผ่าน"}
            </button>
          </form>
        )}

        {first && (
          <p className="mt-6 text-center text-label-md text-on-surface-variant">
            ไม่ใช่บัญชีของคุณ?{" "}
            <Link href="/logout" className="text-primary-container hover:underline">
              ออกจากระบบ
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
