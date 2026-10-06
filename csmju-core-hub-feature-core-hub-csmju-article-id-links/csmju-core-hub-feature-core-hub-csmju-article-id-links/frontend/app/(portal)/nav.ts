import type { ComponentType, SVGProps } from "react";
import { AppsIcon, CampaignIcon, DashboardIcon } from "../components/icons";

export type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Registration, grades and timetables belong to subsystems, not Core Hub
 * (PM 2026-10-05) — the portal links to them through the subsystem menu.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ภาพรวม", Icon: DashboardIcon },
  { href: "/news", label: "ข่าวสาร", Icon: CampaignIcon },
  { href: "/apps", label: "ระบบย่อยทั้งหมด", Icon: AppsIcon },
];
