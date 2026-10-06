"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  CloseIcon,
  LockIcon,
  LogoutIcon,
  MenuIcon,
} from "../components/icons";
import { logout, type SessionUser } from "../lib/session";
import SiteFooter from "../components/SiteFooter";
import SearchBox from "../components/SearchBox";
import { searchBackoffice } from "./search-actions";
import NotificationBell, { type ClassReminder } from "../components/NotificationBell";
import ProfileCard from "../components/ProfileCard";
import type { MyPerson, NotificationList } from "../lib/api";
import { activeNavHref, navGroupsFor } from "./nav";

export default function BackofficeShell({
  user,
  person,
  notifications,
  reminder,
  children,
}: {
  user: SessionUser;
  person: MyPerson | null;
  notifications: NotificationList;
  reminder: ClassReminder | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeHref = activeNavHref(pathname);
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const closeNav = () => setNavOpen(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    const ssoSignOut = await logout();
    if (ssoSignOut) {
      // MJU SSO session: finish the sign-out at sso.mju.ac.th, which sends
      // the browser back to /auth/mju/signout → `/`.
      window.location.assign(ssoSignOut);
      return;
    }
    // `/` shows the public news page once the session cookies are gone.
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh w-full bg-background text-on-surface">
      {/* Scrim for the mobile drawer */}
      <div
        onClick={closeNav}
        aria-hidden
        className={`fixed inset-0 z-20 bg-black/40 transition-opacity duration-300 md:hidden ${
          navOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* SIDE NAV */}
      <aside
        className={`brand-gradient fixed left-0 top-0 z-30 flex h-dvh w-64 flex-col py-4 shadow-xl transition-transform duration-300 ease-out md:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-4 px-4 pt-4">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/"
              onClick={closeNav}
              aria-label="กลับหน้าแรก"
              className="flex w-full justify-center rounded-xl p-2 transition-opacity hover:opacity-80"
            >
              <Image
                src="/csmju-logo.png"
                alt="โลโก้ สาขาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยแม่โจ้"
                width={240}
                height={170}
                priority
                className="h-auto w-full max-w-[120px] object-contain"
              />
            </Link>
            <button
              type="button"
              onClick={closeNav}
              aria-label="ปิดเมนู"
              className="self-start rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="mt-2 flex-1 overflow-y-auto">
          {navGroupsFor(user.role).map((group) => (
            <div key={group.id} className="mb-2">
              {group.labelTh && (
                <p className="mb-1 mt-4 px-7 text-caption uppercase tracking-wider text-white/45">
                  {group.labelTh}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map(({ href, label, labelTh, Icon }) => {
                  const active = href === activeHref;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={closeNav}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 py-2.5 duration-200 ${
                          active
                            ? "border-l-4 border-[#3B80F2] bg-white/10 pl-6 text-white"
                            : "pl-7 text-white/70 transition-all hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="text-label-md">{labelTh}</span>
                        <span className="text-caption text-white/50">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <Link
          href="/account/password"
          onClick={closeNav}
          className="mx-4 mt-4 flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 py-2.5 text-label-md text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          <LockIcon className="h-4 w-4" />
          เปลี่ยนรหัสผ่าน
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="mx-4 mt-2 flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 py-2.5 text-label-md text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-60"
        >
          <LogoutIcon className="h-4 w-4" />
          {loggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
        </button>
      </aside>

      {/* MAIN */}
      {/* min-w-0: a wide table scrolls inside its card instead of stretching the page. */}
      <main className="ml-0 flex min-h-dvh min-w-0 flex-1 flex-col md:ml-64">
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-4 border-b border-surface-variant bg-surface-container-lowest px-4 shadow-sm md:px-12">
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="เปิดเมนู"
              className="rounded-lg p-2 text-on-surface transition-colors hover:bg-surface-variant/50"
            >
              <MenuIcon className="h-6 w-6" />
            </button>
            <h1 className="text-gradient font-display text-headline-md">
              CSMJU Portal
            </h1>
          </div>

          <SearchBox
            search={searchBackoffice}
            label="ค้นหาเมนู บุคคล ระบบย่อย และประกาศ"
            placeholder="ค้นหาเมนู บุคคล ระบบย่อย ประกาศ..."
            className="mx-auto hidden max-w-md flex-1 md:block"
          />

          <div className="flex items-center gap-2 text-on-surface-variant">
            <NotificationBell
              items={notifications.items}
              unread={notifications.unread}
              failed={notifications.failed}
              reminder={reminder}
            />
            <ProfileCard user={user} person={person} variant="header" />
          </div>
        </header>
        {/* On a phone the search box gets its own row under the header. */}
        <div className="relative z-20 border-b border-surface-variant bg-surface-container-lowest px-4 py-2 md:hidden">
          <SearchBox
            search={searchBackoffice}
            label="ค้นหาเมนู บุคคล ระบบย่อย และประกาศ"
            placeholder="ค้นหาเมนู บุคคล ระบบย่อย ประกาศ..."
          />
        </div>

        <div className="mx-auto w-full max-w-[1280px] flex-1 space-y-8 p-4 md:p-12">
          {children}
        </div>

        <SiteFooter />
      </main>
    </div>
  );
}
