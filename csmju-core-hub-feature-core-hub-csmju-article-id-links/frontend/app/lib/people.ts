import type { PersonStatus, PersonType, StaffType } from "./api";
import type { Status } from "./backoffice/types";

/** Badge per `PersonStatus` — the enum is closed, colours per handoff §4.3. */
export const PERSON_STATUS_BADGE: Record<PersonStatus, Status> = {
  ACTIVE: { id: "ACTIVE", label: "กำลังศึกษา / ปฏิบัติงาน", tone: "success" },
  INACTIVE: { id: "INACTIVE", label: "พ้นสภาพ", tone: "error" },
  GRADUATED: { id: "GRADUATED", label: "สำเร็จการศึกษา", tone: "info" },
};

export const PERSON_STATUSES = Object.keys(PERSON_STATUS_BADGE) as PersonStatus[];

export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  STUDENT: "นักศึกษา",
  STAFF: "บุคลากร",
};

export const STAFF_TYPE_LABELS: Record<StaffType, string> = {
  LECTURER: "อาจารย์",
  OFFICER: "เจ้าหน้าที่",
  TECHNICIAN: "นักวิชาการ/ช่างเทคนิค",
  OTHER: "อื่น ๆ",
};

/** `ผศ.ดร. สมชาย ใจดี` — academic title first, when the registry has one. */
export function personDisplayName(person: {
  academicTitle: string | null;
  fullNameTh: string;
}): string {
  return person.academicTitle
    ? `${person.academicTitle} ${person.fullNameTh}`
    : person.fullNameTh;
}
