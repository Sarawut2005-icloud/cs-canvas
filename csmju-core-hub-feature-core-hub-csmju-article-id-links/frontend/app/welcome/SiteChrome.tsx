import Image from "next/image";
import Link from "next/link";
import { ArrowForwardIcon } from "../components/icons";
import SharedFooter from "../components/SiteFooter";

/** Menu of the public website — readable without signing in. */
const PUBLIC_NAV = [
  { href: "/", label: "ข่าวสาร" },
  { href: "/curricula", label: "หลักสูตร" },
];

/** Header of the public pages (news, announcements, curricula). */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-outline-variant/40 bg-surface-container-lowest/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/csmju-logo.png"
            alt="โลโก้ สาขาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยแม่โจ้"
            width={128}
            height={128}
            priority
            className="h-10 w-10 object-contain"
          />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="font-display text-label-md font-extrabold tracking-wide text-primary">
              CSMJU
            </span>
            <span className="text-caption text-on-surface-variant">
              Computer Science
            </span>
          </span>
        </Link>

        <nav aria-label="เมนูหลัก" className="ml-auto flex items-center gap-1 sm:gap-2">
          {PUBLIC_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-2 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary-container sm:px-3"
            >
              {label}
            </Link>
          ))}
        </nav>

        <Link
          href="/login"
          className="btn-gradient inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-label-md text-white shadow-md hover:shadow-lg sm:px-4"
        >
          เข้าสู่ระบบ
          <ArrowForwardIcon className="hidden h-4 w-4 sm:block" />
        </Link>
      </div>
    </header>
  );
}

/** The same footer as the portal (address, contacts, related sites). */
export function SiteFooter() {
  return <SharedFooter />;
}
