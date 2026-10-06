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
  SettingsIcon,
} from "../components/icons";
import { BACKOFFICE_ROLES, logout, type SessionUser } from "../lib/session";
import SubsystemNav from "../components/SubsystemNav";
import SiteFooter from "../components/SiteFooter";
import type { DirectoryEntry, MyPerson, NotificationList } from "../lib/api";
import { NAV_ITEMS } from "./nav";
import NotificationBell, { type ClassReminder } from "../components/NotificationBell";
import ProfileCard from "../components/ProfileCard";
import SearchBox from "../components/SearchBox";
import { searchPortal } from "../lib/site-search";

export default function PortalShell({
  user,
  person,
  subsystems,
  notifications,
  reminder,
  children,
}: {
  user: SessionUser;
  person: MyPerson | null;
  subsystems: DirectoryEntry[];
  notifications: NotificationList;
  reminder: ClassReminder | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
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
      <div
        onClick={closeNav}
        aria-hidden
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-300 md:hidden ${
          navOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* SIDE NAV */}
      <aside
        className={`brand-gradient fixed left-0 top-0 z-40 flex h-dvh w-64 flex-col py-4 shadow-xl transition-transform duration-300 ease-out md:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 mt-2 flex shrink-0 items-center justify-center gap-2 px-6">
          <div className="rounded-full bg-white p-2 shadow-sm">
            <Image
              src="/csmju-logo.png"
              alt="โลโก้ สาขาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยแม่โจ้"
              width={128}
              height={128}
              priority
              className="h-12 w-12 rounded-full object-contain"
            />
          </div>
          <button
            type="button"
            onClick={closeNav}
            aria-label="ปิดเมนู"
            className="ml-auto rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* The menu scrolls on its own: the subsystem list grows with the
            registry, and the profile and sign-out below must stay on screen. */}
        <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-2">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active =
              href === "/" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={closeNav}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-r-lg py-3 text-label-md duration-200 ${
                  active
                    ? "border-l-4 border-white bg-white/10 pl-4 text-white"
                    : "pl-5 text-white/70 transition-all hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Link>
            );
          })}

          {BACKOFFICE_ROLES.includes(user.role) && (
            <Link
              href="/backoffice"
              onClick={closeNav}
              className="flex items-center gap-2 rounded-r-lg py-3 pl-5 text-label-md text-white/70 transition-all duration-200 hover:bg-white/5 hover:text-white"
            >
              <SettingsIcon className="h-5 w-5 shrink-0" />
              ระบบหลังบ้าน
            </Link>
          )}

          <SubsystemNav subsystems={subsystems} onNavigate={closeNav} compact />
        </nav>

        <div className="mb-4 mt-4 flex shrink-0 flex-col gap-3 px-4">
          <ProfileCard user={user} person={person} />
          <Link
            href="/account/password"
            onClick={closeNav}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 py-3 text-label-md text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            <LockIcon className="h-4 w-4" />
            เปลี่ยนรหัสผ่าน
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 py-3 text-label-md text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-60"
          >
            <LogoutIcon className="h-4 w-4" />
            {loggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      {/* min-w-0: a wide child (e.g. a scrolling chip row) must not stretch the page. */}
      <main className="flex min-h-dvh min-w-0 flex-1 flex-col md:ml-64">
        {/* Mobile top app bar */}
        <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-surface-variant bg-surface-container-lowest px-4 md:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="เปิดเมนู"
            className="-ml-2 rounded-lg p-2 text-on-surface transition-colors hover:bg-surface-variant/50"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
          <Image
            src="/csmju-logo.png"
            alt="CSMJU"
            width={96}
            height={96}
            className="h-8 w-8 object-contain"
          />
          <NotificationBell
            items={notifications.items}
            unread={notifications.unread}
            failed={notifications.failed}
            reminder={reminder}
          />
        </header>
        <div className="border-b border-surface-variant bg-surface-container-lowest px-4 py-2 md:hidden">
          <SearchBox
            search={searchPortal}
            label="ค้นหาเมนู ระบบย่อย ข่าวสาร และหลักสูตร"
            placeholder="ค้นหาระบบย่อย ข่าวสาร หลักสูตร..."
          />
        </div>

        {/* Desktop top bar: search and the bell on every portal page. */}
        <header className="sticky top-0 z-30 hidden h-16 w-full items-center gap-4 border-b border-surface-variant bg-surface-container-lowest/95 px-12 backdrop-blur md:flex">
          <SearchBox
            search={searchPortal}
            label="ค้นหาเมนู ระบบย่อย ข่าวสาร และหลักสูตร"
            placeholder="ค้นหาระบบย่อย ข่าวสาร หลักสูตร..."
            className="mx-auto max-w-md flex-1"
          />
          <NotificationBell
            items={notifications.items}
            unread={notifications.unread}
            failed={notifications.failed}
            reminder={reminder}
          />
        </header>

        <div className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 md:px-12">
          {children}
        </div>

        <SiteFooter />
      </main>
    </div>
  );
}
