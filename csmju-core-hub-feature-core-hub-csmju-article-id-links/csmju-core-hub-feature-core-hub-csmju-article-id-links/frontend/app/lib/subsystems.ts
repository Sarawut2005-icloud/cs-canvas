import type {
  ApiErrorCode,
  ApprovalStatus,
  ExceptionStatus,
  LifecycleStatus,
  Subsystem,
  SubsystemCategory,
  SubsystemEvent,
} from "./api";
import type { Status } from "./backoffice/types";
import type { UserRole } from "./session";

/* ------------------------------------------------------------------ */
/* Status badges                                                        */
/* ------------------------------------------------------------------ */

export const APPROVAL_BADGE: Record<ApprovalStatus, Status> = {
  PENDING: { id: "PENDING", label: "รออนุมัติ", tone: "warning" },
  APPROVED: { id: "APPROVED", label: "อนุมัติแล้ว", tone: "success" },
  REJECTED: { id: "REJECTED", label: "ถูกปฏิเสธ", tone: "error" },
};

export const LIFECYCLE_BADGE: Record<LifecycleStatus, Status> = {
  ACTIVE: { id: "ACTIVE", label: "เปิดใช้งาน", tone: "success" },
  INACTIVE: { id: "INACTIVE", label: "ปิดใช้งาน", tone: "neutral" },
  SUSPENDED: { id: "SUSPENDED", label: "ระงับ", tone: "error" },
};

export const EXCEPTION_BADGE: Record<ExceptionStatus, Status> = {
  REQUESTED: { id: "REQUESTED", label: "รอพิจารณา", tone: "warning" },
  APPROVED: { id: "APPROVED", label: "อนุมัติแล้ว", tone: "success" },
  REJECTED: { id: "REJECTED", label: "ถูกปฏิเสธ", tone: "error" },
};

/** Lifecycle only means something once a subsystem is approved. */
export function showsLifecycle(subsystem: Pick<Subsystem, "approvalStatus">) {
  return subsystem.approvalStatus === "APPROVED";
}

export const EVENT_LABELS: Record<SubsystemEvent["action"], string> = {
  SUBMITTED: "ส่งคำขอขึ้นระบบ",
  UPDATED: "แก้ไขข้อมูล",
  APPROVED: "อนุมัติคำขอ",
  REJECTED: "ปฏิเสธคำขอ",
  RESUBMITTED: "ส่งคำขออีกครั้ง",
  ACTIVATED: "เปิดใช้งาน",
  DEACTIVATED: "ปิดใช้งาน",
  SUSPENDED: "ระงับระบบ",
  EXCEPTION_REQUESTED: "ขอสิทธิ์พิเศษ",
  EXCEPTION_APPROVED: "อนุมัติสิทธิ์พิเศษ",
  EXCEPTION_REJECTED: "ปฏิเสธสิทธิ์พิเศษ",
  CHANGE_REQUESTED: "ยื่นคำขอแก้ไข",
  CHANGE_APPROVED: "อนุมัติคำขอแก้ไข",
  CHANGE_REJECTED: "ปฏิเสธคำขอแก้ไข",
  CHANGE_CANCELLED: "ยกเลิกคำขอแก้ไข",
};

/** Field names in the history timeline and change requests. */
export const FIELD_LABELS: Record<string, string> = {
  name: "ชื่อระบบ",
  displayName: "ชื่อที่แสดง",
  category: "หมวด",
  description: "คำอธิบาย",
  listedInMenu: "แสดงในเมนู",
  repo: "Repository",
  standardsVersion: "เวอร์ชันมาตรฐาน",
  callbackUrl: "Callback URL",
  baseUrl: "Base URL",
  defaultRoleMapping: "การแมปบทบาท",
  owner: "เจ้าของระบบ",
};

/**
 * One history value as text: a role mapping reads `student → STUDENT`, a
 * category its Thai label, the menu flag แสดง/ซ่อน.
 */
export function formatFieldValue(value: unknown, field?: string): string {
  if (value === null || value === undefined || value === "") return "(ว่าง)";
  if (field === "category" && typeof value === "string") {
    return categoryLabel(value as SubsystemCategory);
  }
  if (typeof value === "boolean") return value ? "แสดง" : "ซ่อน";
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length === 0
      ? "(ว่าง)"
      : entries.map(([role, mapped]) => `${role} → ${String(mapped)}`).join(", ");
  }
  return String(value);
}

/**
 * "v1.7.2" — the 1.0.x line is closed (handoff 2.7) and an old stored value
 * that is no longer a release (e.g. 1.0) is marked as such.
 */
export function standardsVersionLabel(version: string, released: string[]): string {
  if (!released.includes(version)) return `v${version} (ค่าเดิม — ไม่อยู่ในรายการแล้ว)`;
  return version.startsWith("1.0.") ? `v${version} (ปิดแล้ว)` : `v${version}`;
}

/* ------------------------------------------------------------------ */
/* List tabs                                                            */
/* ------------------------------------------------------------------ */

export type ListTab =
  | "all"
  | "pending"
  | "active"
  | "inactive"
  | "suspended"
  | "rejected";

export const LIST_TABS: { id: ListTab; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "pending", label: "รออนุมัติ" },
  { id: "active", label: "เปิดใช้งาน" },
  { id: "inactive", label: "ปิดใช้งาน" },
  { id: "suspended", label: "ระงับ" },
  { id: "rejected", label: "ถูกปฏิเสธ" },
];

export const TAB_FILTER: Record<
  ListTab,
  { approvalStatus?: ApprovalStatus; status?: LifecycleStatus }
> = {
  all: {},
  pending: { approvalStatus: "PENDING" },
  active: { approvalStatus: "APPROVED", status: "ACTIVE" },
  inactive: { approvalStatus: "APPROVED", status: "INACTIVE" },
  suspended: { approvalStatus: "APPROVED", status: "SUSPENDED" },
  rejected: { approvalStatus: "REJECTED" },
};

export function parseTab(value: string | string[] | undefined): ListTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return LIST_TABS.some((t) => t.id === tab) ? (tab as ListTab) : "all";
}

/* ------------------------------------------------------------------ */
/* What the UI offers each role                                         */
/* ------------------------------------------------------------------ */

/**
 * Mirrors the Core API's permission matrix (backend role-permissions.ts) so
 * the UI can hide what a role can never do (ui-design-system.md §10.1).
 * This is presentation only — the API enforces every rule on every call.
 */
export type SubsystemCapabilities = {
  /** Register a new subsystem — admins, and accounts granted subsystem:create. */
  create: boolean;
  readAny: boolean;
  review: boolean;
  operate: boolean;
  remove: boolean;
  editReviewedFields: boolean;
};

/**
 * `permissions` is GET /auth/me's list (role + per-account grants). Without
 * it only the role is known, so registering is shown to admins only.
 */
export function capabilitiesFor(
  role: UserRole,
  permissions?: readonly string[],
): SubsystemCapabilities {
  const isAdmin = role === "admin";
  return {
    create: isAdmin || (permissions?.includes("subsystem:create") ?? false),
    readAny: isAdmin,
    review: isAdmin,
    operate: isAdmin,
    remove: isAdmin,
    editReviewedFields: isAdmin,
  };
}

/** Core roles in display order, with the standard Thai labels (§10.3). */
export const CORE_ROLES: { role: UserRole; label: string; suggested: string }[] =
  [
    { role: "student", label: "นักศึกษา", suggested: "STUDENT" },
    { role: "alumni", label: "ศิษย์เก่า", suggested: "ALUMNI" },
    { role: "staff", label: "เจ้าหน้าที่ (ไม่ใช่อาจารย์)", suggested: "STAFF" },
    { role: "lecturer", label: "อาจารย์", suggested: "LECTURER" },
    { role: "guest", label: "ผู้เยี่ยมชม", suggested: "GUEST" },
    { role: "admin", label: "ผู้ดูแลระบบ", suggested: "ADMIN" },
  ];

/* ------------------------------------------------------------------ */
/* Errors → Thai (ui-design-system.md §9.3)                             */
/* ------------------------------------------------------------------ */

export type ActionError = {
  code: ApiErrorCode;
  message: string;
  /** Validation messages from the Core API, when it sent a list. */
  details?: string[];
};

/** What a server action hands back to the component that called it. */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Backend messages that deserve a specific explanation. */
const KNOWN_MESSAGES: [RegExp, string][] = [
  [/^Subsystem name already exists$/, "ชื่อระบบนี้ถูกใช้แล้ว กรุณาใช้ชื่ออื่น"],
  [/must contain only lowercase/, "ชื่อระบบใช้ได้เฉพาะ a-z ตัวพิมพ์เล็ก ตัวเลข และขีดกลาง (-)"],
  [/callbackUrl must be an absolute URL/, "callback URL ต้องเป็น URL เต็ม เช่น https://example.ac.th/auth/callback"],
  [/callbackUrl must use HTTPS/, "callback URL ต้องใช้ https (ใช้ http ได้เฉพาะ localhost ระหว่างการพัฒนา)"],
  [/callbackUrl must use http or https/, "callback URL ต้องขึ้นต้นด้วย https://"],
  [/baseUrl must be an absolute URL/, "base URL ต้องเป็น URL เต็ม เช่น https://equipment.csmju2030.ac.th"],
  [/baseUrl must use HTTPS/, "base URL ต้องใช้ https (ใช้ http ได้เฉพาะ localhost ระหว่างการพัฒนา)"],
  [/baseUrl must use http or https/, "base URL ต้องขึ้นต้นด้วย https://"],
  [/^Subsystem owner not found$/, "ไม่พบผู้ใช้ที่ระบุเป็นเจ้าของระบบ"],
  [/^User not found$/, "ไม่พบชื่อผู้ใช้นี้ใน Core Hub"],
  [/^Role not found/, "ไม่พบบทบาทที่ระบุ"],
  [/must be approved before activation/, "ต้องอนุมัติคำขอก่อนจึงจะเปิดใช้งานได้"],
  [/already active/, "ระบบนี้เปิดใช้งานอยู่แล้ว"],
  [/Only an active subsystem can be/, "ปิดใช้งานหรือระงับได้เฉพาะระบบที่เปิดใช้งานอยู่"],
  [/Deactivate the subsystem before deleting it/, "ต้องปิดใช้งานระบบก่อนจึงจะลบได้"],
  [/cannot be (approved|rejected) from status/, "คำขอนี้ได้รับการพิจารณาไปแล้ว กรุณารีเฟรชหน้า"],
  [/Only a rejected subsystem can be resubmitted/, "ส่งคำขออีกครั้งได้เฉพาะคำขอที่ถูกปฏิเสธ"],
  [/cannot be changed directly — submit a change request/, "ระบบนี้อนุมัติแล้ว แก้ callback URL · base URL · การแมปบทบาทโดยตรงไม่ได้ — กด \"ขอแก้ไข\" ในหน้ารายละเอียดเพื่อยื่นคำขอให้ผู้ดูแลระบบอนุมัติ"],
  [/name can only be changed by an administrator/, "เปลี่ยนชื่อระบบได้เฉพาะผู้ดูแลระบบ (ชื่อระบบคือ azp ใน token)"],
  [/already has a pending change request/, "ระบบนี้มีคำขอแก้ไขรออนุมัติอยู่แล้ว — รอผลหรือยกเลิกคำขอเดิมก่อน"],
  [/no longer pending/, "คำขอแก้ไขนี้ได้รับการพิจารณาหรือถูกยกเลิกไปแล้ว กรุณารีเฟรชหน้า"],
  [/must change at least one of/, "คำขอแก้ไขต้องเปลี่ยนอย่างน้อย 1 ช่องจากค่าปัจจุบัน"],
  [/Only an approved subsystem takes change requests/, "ยื่นคำขอแก้ไขได้เฉพาะระบบที่อนุมัติแล้ว — ระบบที่ยังไม่อนุมัติแก้ได้โดยตรง"],
  [/Only the owner who asked can cancel/, "ยกเลิกได้เฉพาะเจ้าของระบบหรือผู้ที่ยื่นคำขอ"],
  [/standardsVersion must be a released/, "เวอร์ชันมาตรฐานต้องเป็นเวอร์ชันที่ออกจริงของ csmju2030-standards — เลือกจากรายการ"],
  [/list of standards versions is unavailable/, "ตรวจเวอร์ชันมาตรฐานไม่ได้ในขณะนี้ กรุณาลองใหม่ภายหลัง"],
  [/permission must be one of/, "ให้สิทธิ์รายบัญชีได้เฉพาะสิทธิ์ลงทะเบียนระบบย่อย"],
  [/under your own account/, "ลงทะเบียนระบบได้เฉพาะในนามของตัวเอง"],
  [/reason should not be empty|reason must be/, "กรุณาระบุเหตุผล"],
];

export function describeError(error: ActionError): string {
  const known = KNOWN_MESSAGES.find(([pattern]) => pattern.test(error.message));

  switch (error.code) {
    case "FORBIDDEN":
      return (
        known?.[1] ??
        "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ"
      );
    case "NOT_FOUND":
      return (
        known?.[1] ??
        "ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง"
      );
    case "CONFLICT":
      return (
        known?.[1] ??
        "ข้อมูลถูกแก้ไขโดยผู้ใช้อื่นแล้ว กรุณารีเฟรชและลองใหม่"
      );
    case "VALIDATION_ERROR":
    case "BAD_REQUEST":
      return known?.[1] ?? "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง";
    case "UNAUTHORIZED":
      return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
    default:
      return "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง";
  }
}

/**
 * describeError for the subsystem registry pages: a known message gets its
 * Thai explanation (also when it sits in the validation list); anything else
 * keeps the Core API's own words after the generic text, so a failed save
 * never ends in a form that says nothing useful (handoff 3ก.4).
 */
export function describeRegistryError(error: ActionError): string {
  const raw = [error.message, ...(error.details ?? [])].filter(Boolean);
  const known = KNOWN_MESSAGES.find(([pattern]) =>
    raw.some((text) => pattern.test(text)),
  );
  if (known) return known[1];

  const generic = describeError(error);
  if (error.code === "INTERNAL_ERROR" || error.code === "UNAUTHORIZED") {
    return generic;
  }
  const apiText = [...new Set(raw)].join(" · ");
  return apiText ? `${generic} — ${apiText}` : generic;
}

/* ------------------------------------------------------------------ */
/* Client-side validation (the API validates again)                     */
/* ------------------------------------------------------------------ */

/** Same rule as the Core API DTO and `/sso/authorize`: 1–64, no leading,
 * trailing or doubled hyphen. */
export const NAME_PATTERN = /^(?=.{1,64}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Same transport rule as the Core API's URL check (callbackUrl and baseUrl):
 * absolute, https — plain http only for localhost during development.
 */
function registrableUrlProblem(
  value: string,
  label: string,
  example: string,
): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return `${label} ต้องเป็น URL เต็ม เช่น ${example}`;
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol === "https:") return null;
  if (url.protocol === "http:" && local) return null;
  return `${label} ต้องใช้ https (ใช้ http ได้เฉพาะ localhost ระหว่างการพัฒนา)`;
}

export function callbackUrlProblem(value: string): string | null {
  return registrableUrlProblem(
    value,
    "callback URL",
    "https://example.ac.th/auth/callback",
  );
}

/** The Monitor probes `<baseUrl>/api/health`, so the origin alone is enough. */
export function baseUrlProblem(value: string): string | null {
  return registrableUrlProblem(value, "base URL", "https://example.ac.th");
}

/** Categories of the portal's subsystem menu, in the order they are shown. */
export const SUBSYSTEM_CATEGORIES: {
  value: SubsystemCategory;
  label: string;
  /** Shown when registering: what belongs in this category. */
  hint: string;
}[] = [
  { value: "LEARNING", label: "การเรียนการสอน", hint: "ใช้ในรายวิชา เช่น ส่งงาน แบบทดสอบ เช็คชื่อ ถาม-ตอบ" },
  { value: "CODING", label: "ฝึกเขียนโปรแกรม", hint: "โจทย์ แข่งขัน หรือเกมฝึกทักษะการเขียนโปรแกรม" },
  { value: "CAREER_ACTIVITY", label: "ฝึกงาน สหกิจ และกิจกรรม", hint: "สถานที่ฝึกงาน สหกิจศึกษา ชั่วโมงและแผนกิจกรรม" },
  { value: "COMMUNITY", label: "ชุมชน", hint: "พื้นที่พูดคุย แบ่งปัน หรือเครือข่ายของสาขา" },
  { value: "STUDENT_SERVICE", label: "บริการนักศึกษา", hint: "ทุน แจ้งซ่อม แผนที่ ร้านค้า และบริการอื่นของสาขา" },
  { value: "TOOLS", label: "เครื่องมือ", hint: "เครื่องมือช่วยทำงานทั่วไป ไม่ผูกกับรายวิชาใด" },
  { value: "OTHER", label: "อื่นๆ", hint: "ไม่เข้าหมวดใดข้างต้น" },
];

export function categoryLabel(category: SubsystemCategory): string {
  return SUBSYSTEM_CATEGORIES.find((c) => c.value === category)?.label ?? "อื่นๆ";
}

/** The menu groups subsystems by category once there are more than this. */
export const GROUP_MENU_FROM = 7;

/** Directory entries grouped in category order; empty categories left out. */
export function groupByCategory<T extends { category: SubsystemCategory }>(
  entries: T[],
): { value: SubsystemCategory; label: string; entries: T[] }[] {
  return SUBSYSTEM_CATEGORIES.map((c) => ({
    ...c,
    entries: entries.filter((e) => (e.category ?? "OTHER") === c.value),
  })).filter((g) => g.entries.length > 0);
}
