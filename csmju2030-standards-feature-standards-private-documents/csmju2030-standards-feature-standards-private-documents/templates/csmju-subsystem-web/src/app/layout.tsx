import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_Thai } from "next/font/google";
import { CsmjuAppShell, type NavItem } from "@/csmju";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
});

// TODO: เปลี่ยนเป็นชื่อระบบย่อยของคุณ (ต้องตรงกับ display_name ใน subsystem.yaml)
const DISPLAY_NAME = "ระบบตัวอย่าง";

// TODO: เมนูของระบบย่อย — icon เลือกได้จาก NavIconName ใน src/csmju/CsmjuAppShell.tsx
const NAV: NavItem[] = [
  { label: "ภาพรวม", labelEn: "Overview", href: "/", icon: "dashboard" },
];

// Core Hub web origin for the "กลับ CSMJU Portal" link — from .env, never hardcoded.
const CORE_HUB_WEB_URL = process.env.CORE_HUB_WEB_URL;

export const metadata: Metadata = {
  title: {
    template: `%s · ${DISPLAY_NAME} · CSMJU`,
    default: `${DISPLAY_NAME} · CSMJU`,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${jakarta.variable} ${notoSansThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-on-surface">
        <CsmjuAppShell
          displayName={DISPLAY_NAME}
          nav={NAV}
          // TODO: ผู้ใช้มาจาก GET /api/v1/me ของ backend ระบบนี้ (ไม่ใช่จาก Core Hub ตรง ๆ)
          // ปุ่มออกจากระบบเป็นฟอร์ม POST /auth/logout อยู่ใน CsmjuAppShell แล้ว (auth-contract.md ข้อ 5)
          user={{ initials: "AD", roleLabel: "ผู้ดูแลระบบ" }}
          coreHubUrl={CORE_HUB_WEB_URL}
        >
          {children}
        </CsmjuAppShell>
      </body>
    </html>
  );
}
