import type { ComponentType, SVGProps } from "react";
import {
  AccountCircleIcon,
  AppsIcon,
  CampaignIcon,
  DashboardIcon,
  DatabaseIcon,
  GroupIcon,
  ManageAccountsIcon,
  MonitorHeartIcon,
  PersonIcon,
  SchoolIcon,
} from "../components/icons";
import type { UserRole } from "../lib/session";

export type NavItem = {
  href: string;
  label: string;
  labelTh: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Shown only to these roles (the API enforces the real permission). */
  roles?: UserRole[];
};

/** A sidebar section: the heading is a label, not a link. */
export type NavGroup = {
  id: string;
  /** Omitted for the top-level items (ภาพรวม). */
  labelTh?: string;
  items: NavItem[];
};

const ADMIN_ONLY: UserRole[] = ["admin"];

/**
 * Backoffice menu — order and grouping fixed by the PM (BACKOFFICE_DATA
 * handoff 2.1): announcements sit under the overview, CSV import lives on
 * the people pages, there is no settings page.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    items: [
      { href: "/backoffice", label: "Overview", labelTh: "ภาพรวม", Icon: DashboardIcon },
      { href: "/backoffice/news", label: "News", labelTh: "ประกาศ", Icon: CampaignIcon },
      // The personal portal dashboard — staff and lecturers reach it from the
      // portal itself, so only admins keep the shortcut here (handoff 2.8).
      {
        href: "/",
        label: "My dashboard",
        labelTh: "แดชบอร์ดของฉัน",
        Icon: PersonIcon,
        roles: ADMIN_ONLY,
      },
    ],
  },
  {
    id: "subsystems",
    labelTh: "ระบบย่อย",
    items: [
      { href: "/backoffice/subsystems", label: "Registry", labelTh: "ทะเบียนระบบย่อย", Icon: AppsIcon },
      { href: "/backoffice/subsystems/monitor", label: "Monitor", labelTh: "Monitor", Icon: MonitorHeartIcon },
    ],
  },
  {
    id: "master-data",
    labelTh: "ข้อมูลกลาง",
    items: [
      { href: "/backoffice/students", label: "Students", labelTh: "นักศึกษา", Icon: GroupIcon },
      {
        href: "/backoffice/advisees",
        label: "Advisees",
        labelTh: "นักศึกษาในที่ปรึกษา",
        Icon: AccountCircleIcon,
        roles: ["lecturer"],
      },
      { href: "/backoffice/faculty", label: "Faculty", labelTh: "บุคลากร", Icon: SchoolIcon },
      { href: "/backoffice/reference", label: "Reference", labelTh: "ข้อมูลอ้างอิง", Icon: DatabaseIcon },
    ],
  },
  {
    id: "system",
    labelTh: "ระบบ",
    items: [
      {
        href: "/backoffice/users",
        label: "Users",
        labelTh: "บัญชีผู้ใช้",
        Icon: ManageAccountsIcon,
        roles: ADMIN_ONLY,
      },
    ],
  },
];

/** Groups with only the items `role` may see; empty groups are dropped. */
export function navGroupsFor(role: UserRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

/**
 * The single item a path highlights: the longest `href` that is the path or
 * one of its ancestors, so `/backoffice/subsystems/monitor` lights Monitor
 * and not the registry. `/backoffice` itself only matches exactly.
 */
export function activeNavHref(pathname: string): string | undefined {
  let best: string | undefined;
  for (const { items } of NAV_GROUPS) {
    for (const { href } of items) {
      const matches =
        href === "/backoffice"
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
      if (matches && (!best || href.length > best.length)) best = href;
    }
  }
  return best;
}
