"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowBackIcon,
  ArrowForwardIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  PersonIcon,
  ShieldIcon,
} from "../components/icons";
import { CORE_HUB_BLOCKED_NEXT, safeNextPath } from "../lib/next-path";
import { mjuReauthUrl } from "../lib/password-setup";
import { homePathFor } from "../lib/session";
import { SITE } from "../lib/site";

/** Where "ติดต่อฝ่ายไอที" goes — the department's address in lib/site.ts. */
const SITE_EMAIL =
  SITE.contacts.find((c) => c.label === "อีเมล")?.value ?? "cs@mju.ac.th";

/** Generic messages for `?sso_error=` set by /auth/mju/signin — never details. */
const SSO_ERRORS: Record<string, string> = {
  rejected: "MJU SSO ไม่ยอมรับการเข้าสู่ระบบนี้ (รหัสหมดอายุ) กรุณาลองใหม่",
  invalid: "ข้อมูลที่ได้รับจาก MJU SSO ไม่ถูกต้อง กรุณาลองใหม่",
  not_registered:
    "บัญชี MJU นี้ยังไม่มีสิทธิ์ใช้ CSMJU2030 กรุณาติดต่อเจ้าหน้าที่ภาควิชา",
  conflict:
    "บัญชีนี้ผูกกับบัญชี MJU อื่นอยู่แล้ว กรุณาติดต่อเจ้าหน้าที่ภาควิชา",
  unavailable: "ไม่สามารถติดต่อ MJU SSO ได้ในขณะนี้ กรุณาลองใหม่ภายหลัง",
  disabled: "เซิร์ฟเวอร์นี้ยังไม่ได้เปิดใช้ MJU SSO",
};

const FEATURES = [
  "เข้าทุกระบบของสาขาด้วยบัญชีเดียว",
  "แจ้งเตือนกำหนดการสำคัญแบบเรียลไทม์",
  "ปลอดภัยด้วยการยืนยันตัวตนหลายชั้น",
];

const inputClass =
  "input-field w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-3 pl-10 text-body-md text-on-surface placeholder:text-outline/70";

/** The query string does not change while the login page is open. */
const noSubscribe = () => () => {};

function Logo() {
  return (
    <Link href="/" aria-label="กลับหน้าข่าวสาร" className="flex items-center gap-3">
      <div className="rounded-full bg-white p-2 shadow-sm">
        <Image
          src="/csmju-logo.png"
          alt="โลโก้ สาขาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยแม่โจ้"
          width={128}
          height={128}
          priority
          className="h-12 w-12 object-contain"
        />
      </div>
      <div className="hidden flex-col leading-tight text-white md:flex">
        <span className="font-display text-label-md font-extrabold tracking-wide">
          CSMJU
        </span>
        <span className="text-caption text-primary-fixed opacity-80">
          Computer Science
        </span>
      </div>
    </Link>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // /account/password sends the user here with every session revoked.
  // The URL is unknown while prerendering, so the server snapshot is false.
  const passwordChanged = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("password") === "changed",
    () => false,
  );
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  // A failed MJU SSO round trip lands here with ?sso_error=<reason>; show
  // the matching generic message once the page is on screen.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("sso_error");
    if (!code) return;
    const message = SSO_ERRORS[code] ?? SSO_ERRORS.unavailable;
    timers.current.push(setTimeout(() => setErrorMessage(message), 0));
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loginLoading) return;
    if (!loginEmail.trim() || !password.trim()) {
      setErrorMessage("กรุณากรอกอีเมลและรหัสผ่าน");
      setError(true);
      later(() => setError(false), 500);
      return;
    }
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), password, remember }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        // The route handler already translates the Core API's rejection;
        // showing it verbatim is what tells the user what to change.
        setErrorMessage(
          body?.error?.message ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        );
        setError(true);
        later(() => setError(false), 500);
        setLoginLoading(false);
        return;
      }
      // /api/auth/login answers with the signed-in role, so admin and staff go
      // straight to the backoffice — the same rule proxy.ts applies to /login.
      //
      // `next` is checked, not just tested for a leading "/": "//evil.example"
      // starts with one too and leaves the site.
      //
      // A full navigation rather than router.replace: `next` is often
      // /sso/authorize, a route handler that redirects off-site. The client
      // router would fetch it as an RSC request first, calling the handoff a
      // second time and sending the subsystem a callback without its cookie.
      const next = safeNextPath(
        new URLSearchParams(window.location.search).get("next"),
        CORE_HUB_BLOCKED_NEXT,
      );
      window.location.assign(next ?? homePathFor(body.data?.role));
    } catch {
      setErrorMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
      setError(true);
      later(() => setError(false), 500);
      setLoginLoading(false);
    }
  };

  // Carries `next` through the MJU round trip, so a sign-in a subsystem
  // started (/sso/authorize) continues there instead of stopping at home.
  // The link's own navigation does the rest: /auth/mju/login is a route
  // handler that leaves for sso.mju.ac.th, so it must be a full page load.
  const goMjuSso = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const next = safeNextPath(
      new URLSearchParams(window.location.search).get("next"),
      CORE_HUB_BLOCKED_NEXT,
    );
    if (next) {
      event.currentTarget.href = `/auth/mju/login?${new URLSearchParams({ next }).toString()}`;
    }
  };

  const goForgot = () => setMode("forgot");

  const isForgot = mode === "forgot";

  return (
    <div
      className={`relative h-dvh w-full overflow-hidden bg-background ${
        isForgot ? "forgot-mode" : ""
      }`}
    >
      {/* BRAND PANEL */}
      <div className="brand-panel-anim panel-anim brand-gradient absolute left-0 top-0 z-20 flex h-1/3 w-full shrink-0 flex-col justify-between overflow-hidden p-4 text-on-primary shadow-xl md:h-full md:w-[42%] md:p-12">
        <div className="glow-circle left-[-10%] top-[-10%] h-64 w-64 bg-[#3B80F2]" />
        <div className="glow-circle bottom-[-20%] right-[-10%] h-96 w-96 bg-[#F59E0B] opacity-20" />

        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="fade-slide-up flex items-start">
            <Logo />
          </div>

          <div className="fade-slide-up stagger-1 mb-auto mt-12 hidden flex-col gap-6 md:flex">
            <div>
              <h1 className="mb-4 font-display text-headline-lg text-white">
                ระบบบริหารจัดการ
                <br />
                แผนกวิชาการ
              </h1>
              <p className="max-w-md text-body-lg leading-relaxed text-primary-fixed opacity-90">
                จัดการหลักสูตร ตารางเรียน และข้อมูลนักศึกษาในที่เดียว
                เข้าถึงได้ทุกที่ ทุกเวลา ปลอดภัยด้วยระบบยืนยันตัวตน
              </p>
            </div>
            <ul className="mt-8 space-y-4">
              {FEATURES.map((feature, index) => (
                <li
                  key={feature}
                  className={`fade-slide-up stagger-${index + 1} flex items-center gap-4`}
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                    <CheckIcon className="h-4 w-4 text-white" />
                  </span>
                  <span className="text-body-md text-white opacity-90">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="fade-slide-up stagger-1 mb-4 mt-auto md:hidden">
            <h1 className="font-display text-[24px] font-bold leading-[1.3] text-white">
              ระบบบริหารจัดการวิชาการ
            </h1>
          </div>

          <div className="fade-slide-up stagger-3 mt-auto hidden md:block">
            <p className="text-caption text-primary-fixed opacity-70">
              © 2026 Computer Science, Maejo University
            </p>
          </div>
        </div>
      </div>

      {/* FORM AREA */}
      <div className="form-area-anim panel-anim absolute bottom-0 right-0 z-10 flex h-2/3 w-full flex-col items-center justify-center overflow-y-auto bg-background p-4 md:h-full md:w-[58%] md:p-12">
        <div className="relative w-full max-w-[420px]">
          {/* LOGIN */}
          <div
            className={`form-section-anim w-full ${
              isForgot ? "form-section-hidden -translate-x-5" : ""
            }`}
            aria-hidden={isForgot}
          >
            <div className="fade-slide-up flex w-full flex-col gap-6 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_4px_12px_rgba(33,84,217,0.1)]">
              <div className="fade-slide-up stagger-1 text-center md:text-left">
                <span className="mb-4 inline-block rounded-full bg-primary-container/10 px-3 py-1 text-label-md uppercase tracking-wider text-primary">
                  ระบบแผนกวิชาการ
                </span>
                <h2 className="mb-2 font-display text-headline-md text-on-surface">
                  ยินดีต้อนรับกลับ
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  กรอกข้อมูลเพื่อเข้าสู่ระบบบัญชีของคุณ
                </p>
              </div>

              {passwordChanged && (
                <p
                  role="status"
                  className="mb-5 flex items-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-label-md text-emerald-700"
                >
                  <CheckIcon className="h-4 w-4 shrink-0" />
                  เปลี่ยนรหัสผ่านแล้ว ออกจากระบบทุกเครื่องแล้ว — เข้าสู่ระบบด้วยรหัสผ่านใหม่
                </p>
              )}

              <form
                className="fade-slide-up stagger-2 flex flex-col gap-5"
                onSubmit={handleLogin}
                noValidate
              >
                <div className="flex flex-col gap-2">
                  <label
                    className="text-label-md text-on-surface"
                    htmlFor="username"
                  >
                    อีเมล
                  </label>
                  <div className={`relative ${error ? "shake-anim" : ""}`}>
                    <PersonIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
                    <input
                      id="username"
                      type="email"
                      autoComplete="username"
                      placeholder="you@core.local"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className={`${inputClass} pr-4 ${error ? "input-error" : ""}`}
                    />
                  </div>
                </div>

                {errorMessage && (
                  <p className="text-label-md text-error">{errorMessage}</p>
                )}

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-label-md text-on-surface"
                      htmlFor="password"
                    >
                      รหัสผ่าน
                    </label>
                    <button
                      type="button"
                      onClick={goForgot}
                      className="link-hover cursor-pointer text-label-md text-primary"
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>
                  <div className={`relative ${error ? "shake-anim" : ""}`}>
                    <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-10 ${error ? "input-error" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-on-surface"
                    >
                      {showPassword ? (
                        <EyeIcon className="h-5 w-5" />
                      ) : (
                        <EyeOffIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="custom-checkbox mt-1 flex items-center gap-3">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <label
                    className="cursor-pointer select-none text-body-md text-on-surface-variant"
                    htmlFor="remember"
                  >
                    จดจำการเข้าสู่ระบบ
                  </label>
                </div>

                <button
                  type="submit"
                  className={`btn-gradient relative mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-label-md text-white shadow-md hover:shadow-lg ${
                    loginLoading ? "btn-loading" : ""
                  }`}
                >
                  <span className="btn-text flex items-center gap-2 transition-opacity duration-150">
                    เข้าสู่ระบบ
                    <ArrowForwardIcon className="h-4 w-4" />
                  </span>
                  <span className="dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                </button>

                <div className="my-2 flex items-center gap-4">
                  <div className="h-px flex-grow bg-outline-variant/30" />
                  <span className="text-caption uppercase tracking-widest text-outline">
                    หรือ
                  </span>
                  <div className="h-px flex-grow bg-outline-variant/30" />
                </div>

                <a
                  href="/auth/mju/login"
                  onClick={goMjuSso}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2D8A61] bg-[#E8F5EE] py-3 text-label-md text-[#2D8A61] shadow-sm transition-all duration-150 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
                >
                  <ShieldIcon className="h-5 w-5" />
                  เข้าสู่ระบบด้วย MJU SSO
                </a>
              </form>

              {/* PM 2026-10-05 (handoff 2.4): the public pages only — no
                  session, no token. Subsystems still need a real account. */}
              <Link
                href="/"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant py-3 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                <PersonIcon className="h-5 w-5" />
                เข้าชมแบบผู้เยี่ยมชม
              </Link>
              <p className="mt-2 text-center text-caption text-on-surface-variant">
                ดูข่าวสารและหลักสูตรได้โดยไม่ต้องเข้าสู่ระบบ · ระบบย่อยต้องเข้าสู่ระบบก่อนใช้งาน
              </p>
            </div>

            <div className="fade-slide-up stagger-3 mt-6 text-center">
              <p className="text-body-md text-on-surface-variant">
                ต้องการความช่วยเหลือ?{" "}
                <a
                  className="link-hover font-bold text-label-md text-primary"
                  href={`mailto:${SITE_EMAIL}`}
                >
                  ติดต่อฝ่ายไอที
                </a>
              </p>
            </div>
          </div>

          {/* FORGOT PASSWORD */}
          <div
            className={`form-section-anim absolute left-0 top-0 w-full ${
              isForgot ? "" : "form-section-hidden translate-x-5"
            }`}
            aria-hidden={!isForgot}
          >
            <div className="flex w-full flex-col gap-6 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_4px_12px_rgba(33,84,217,0.1)]">
              <div className="text-center md:text-left">
                <span className="mb-4 inline-block rounded-full bg-primary-container/10 px-3 py-1 text-label-md uppercase tracking-wider text-primary">
                  กู้คืนบัญชี
                </span>
                <h2 className="mb-2 font-display text-headline-md text-on-surface">
                  ลืมรหัสผ่าน?
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  ยืนยันตัวตนด้วย MJU SSO (บัญชีเดียวกับระบบของมหาวิทยาลัย)
                  แล้วตั้งรหัสผ่าน CSMJU2030 ใหม่ได้ทันที โดยไม่ต้องใช้รหัสเดิม
                </p>
              </div>

              <div className="flex flex-col gap-5">
                <p className="rounded-lg bg-surface px-4 py-3 text-body-md text-on-surface-variant">
                  ต้องตั้งรหัสใหม่ให้เสร็จภายใน 10 นาทีหลังยืนยันตัวตน —
                  ตั้งแล้วจะออกจากระบบเครื่องอื่นทั้งหมด
                </p>

                {/* A full page load: /auth/mju/login leaves for sso.mju.ac.th. */}
                <a
                  href={mjuReauthUrl()}
                  tabIndex={isForgot ? undefined : -1}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2D8A61] bg-[#E8F5EE] py-3 text-label-md text-[#2D8A61] shadow-sm transition-all duration-150 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
                >
                  <ShieldIcon className="h-5 w-5" />
                  ยืนยันตัวตนด้วย MJU SSO เพื่อตั้งรหัสใหม่
                </a>

                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="link-hover mx-auto mt-2 flex w-fit items-center justify-center gap-1 text-label-md text-primary"
                >
                  <ArrowBackIcon className="h-4 w-4" />
                  กลับสู่หน้าเข้าสู่ระบบ
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
