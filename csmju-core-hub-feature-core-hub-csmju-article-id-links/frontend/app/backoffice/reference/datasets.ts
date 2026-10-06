import type { ReferenceDataset, RoomType } from "../../lib/api";

/**
 * Everything the reference page knows about each dataset, as plain data so
 * the server page and the client editor read the same definitions:
 * the tab label, table columns, filters and the form fields.
 *
 * Backend contract (reference-data module): `code` is chosen on create and
 * never changes; there is no delete — `isActive` is toggled instead (B10).
 */

/** Tab order fixed by the PM (BACKOFFICE_DATA handoff 2.5) — most used first. */
export const DATASETS: ReferenceDataset[] = [
  "courses",
  "curricula",
  "rooms",
  "academic-terms",
  "buildings",
  "departments",
  "faculties",
];

export const DATASET_LABELS: Record<ReferenceDataset, string> = {
  faculties: "คณะ",
  departments: "สาขา",
  buildings: "อาคาร",
  rooms: "ห้อง",
  "academic-terms": "ภาคการศึกษา",
  courses: "รายวิชา",
  curricula: "หลักสูตร",
};

export function isDataset(value: unknown): value is ReferenceDataset {
  return typeof value === "string" && (DATASETS as string[]).includes(value);
}

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  LECTURE: "ห้องบรรยาย",
  LAB: "ห้องปฏิบัติการ",
  SEMINAR: "ห้องสัมมนา",
  MEETING: "ห้องประชุม",
  PROJECT: "ห้องทำโครงงาน",
  OFFICE: "ห้องทำงาน",
};

export const NEW_CODE_HINT =
  "ตัวพิมพ์ใหญ่ ตัวเลข และ - เท่านั้น เช่น SCI หรือ LAB-1 · ตั้งแล้วแก้ไม่ได้";

/** How a table cell is rendered — data only, so it can cross to the client. */
export type ColumnFormat =
  | "text"
  | "number"
  | "date"
  | "roomType"
  | "current"
  | "coords";

export type Column = {
  key: string;
  label: string;
  format?: ColumnFormat;
  /** Read from a nested object, e.g. `faculty.nameTh`. */
  path?: string;
};

/** Options for a select: another dataset (loaded by the page) or a fixed list. */
export type SelectSource =
  | { dataset: "faculties" | "buildings" | "departments" }
  | { options: { value: string; label: string }[] };

export type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date";
  required?: boolean;
  /** Chosen once — hidden from the edit form (contract D5). */
  createOnly?: boolean;
  hint?: string;
  placeholder?: string;
  pattern?: RegExp;
  patternMessage?: string;
  /** For `number`: integers only (default) or decimals. */
  decimals?: boolean;
  select?: SelectSource;
};

export type Filter = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  select?: SelectSource;
};

export type DatasetDefinition = {
  label: string;
  singular: string;
  columns: Column[];
  filters: Filter[];
  fields: Field[];
  /** Datasets whose active rows are needed for selects (filters + form). */
  needs: ("faculties" | "buildings" | "departments")[];
};

const CODE_PATTERN = /^[A-Z0-9-]+$/;

const codeField = (label = "รหัส", extra: Partial<Field> = {}): Field => ({
  key: "code",
  label,
  type: "text",
  required: true,
  createOnly: true,
  hint: NEW_CODE_HINT,
  pattern: CODE_PATTERN,
  patternMessage: "รหัสใช้ได้เฉพาะตัวพิมพ์ใหญ่ ตัวเลข และ -",
  ...extra,
});

const ROOM_TYPE_OPTIONS = (Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map(
  (value) => ({ value, label: ROOM_TYPE_LABELS[value] }),
);

export const DEFINITIONS: Record<ReferenceDataset, DatasetDefinition> = {
  faculties: {
    label: "คณะ",
    singular: "คณะ",
    columns: [
      { key: "code", label: "รหัส" },
      { key: "nameTh", label: "ชื่อ (ไทย)" },
      { key: "nameEn", label: "ชื่อ (อังกฤษ)" },
    ],
    filters: [{ key: "q", label: "ค้นหา (รหัส/ชื่อ)", type: "text" }],
    fields: [
      codeField(),
      { key: "nameTh", label: "ชื่อ (ไทย)", type: "text", required: true },
      { key: "nameEn", label: "ชื่อ (อังกฤษ)", type: "text", required: true },
    ],
    needs: [],
  },
  departments: {
    label: "สาขา",
    singular: "สาขา",
    columns: [
      { key: "code", label: "รหัส" },
      { key: "nameTh", label: "ชื่อ (ไทย)" },
      { key: "nameEn", label: "ชื่อ (อังกฤษ)" },
      { key: "faculty", label: "คณะ", path: "faculty.nameTh" },
    ],
    filters: [
      { key: "q", label: "ค้นหา (รหัส/ชื่อ)", type: "text" },
      { key: "facultyCode", label: "คณะ", type: "select", select: { dataset: "faculties" } },
    ],
    fields: [
      codeField(),
      { key: "nameTh", label: "ชื่อ (ไทย)", type: "text", required: true },
      { key: "nameEn", label: "ชื่อ (อังกฤษ)", type: "text", required: true },
      {
        key: "facultyCode",
        label: "คณะ",
        type: "select",
        required: true,
        select: { dataset: "faculties" },
      },
    ],
    needs: ["faculties"],
  },
  buildings: {
    label: "อาคาร",
    singular: "อาคาร",
    columns: [
      { key: "code", label: "รหัส" },
      { key: "nameTh", label: "ชื่อ (ไทย)" },
      { key: "nameEn", label: "ชื่อ (อังกฤษ)" },
      { key: "latitude", label: "พิกัด", format: "coords" },
    ],
    filters: [{ key: "q", label: "ค้นหา (รหัส/ชื่อ)", type: "text" }],
    fields: [
      codeField(),
      { key: "nameTh", label: "ชื่อ (ไทย)", type: "text", required: true },
      { key: "nameEn", label: "ชื่อ (อังกฤษ)", type: "text" },
      { key: "latitude", label: "ละติจูด", type: "number", decimals: true, placeholder: "18.89" },
      { key: "longitude", label: "ลองจิจูด", type: "number", decimals: true, placeholder: "99.01" },
    ],
    needs: [],
  },
  rooms: {
    label: "ห้อง",
    singular: "ห้อง",
    columns: [
      { key: "code", label: "รหัส" },
      { key: "nameTh", label: "ชื่อห้อง" },
      { key: "building", label: "อาคาร" },
      { key: "floor", label: "ชั้น", format: "number" },
      { key: "roomType", label: "ประเภท", format: "roomType" },
      { key: "capacity", label: "ความจุ", format: "number" },
    ],
    filters: [
      { key: "q", label: "ค้นหา (รหัส/ชื่อ)", type: "text" },
      { key: "buildingCode", label: "อาคาร", type: "select", select: { dataset: "buildings" } },
      { key: "floor", label: "ชั้น", type: "number" },
      { key: "roomType", label: "ประเภท", type: "select", select: { options: ROOM_TYPE_OPTIONS } },
    ],
    fields: [
      codeField("รหัสห้อง"),
      { key: "nameTh", label: "ชื่อห้อง", type: "text", required: true },
      {
        key: "buildingCode",
        label: "อาคาร",
        type: "select",
        required: true,
        select: { dataset: "buildings" },
      },
      { key: "floor", label: "ชั้น", type: "number", required: true },
      {
        key: "roomType",
        label: "ประเภท",
        type: "select",
        required: true,
        select: { options: ROOM_TYPE_OPTIONS },
      },
      { key: "capacity", label: "ความจุ (ที่นั่ง)", type: "number" },
      { key: "facultyCode", label: "คณะเจ้าของ", type: "select", select: { dataset: "faculties" } },
    ],
    needs: ["buildings", "faculties"],
  },
  "academic-terms": {
    label: "ภาคการศึกษา",
    singular: "ภาคการศึกษา",
    columns: [
      { key: "code", label: "รหัส" },
      { key: "academicYear", label: "ปีการศึกษา", format: "number" },
      { key: "semester", label: "ภาค", format: "number" },
      { key: "startDate", label: "เริ่ม", format: "date" },
      { key: "endDate", label: "สิ้นสุด", format: "date" },
      { key: "isCurrent", label: "ปัจจุบัน", format: "current" },
    ],
    filters: [{ key: "q", label: "ค้นหา (รหัสภาค เช่น 2569)", type: "text" }],
    fields: [
      codeField("รหัสภาค", {
        hint: "รูปแบบ <ปี พ.ศ.>-<ภาค> เช่น 2569-1 · ตั้งแล้วแก้ไม่ได้",
        pattern: /^\d{4}-[1-3]$/,
        patternMessage: "รหัสต้องเป็น <ปี พ.ศ.>-<ภาค> เช่น 2569-1",
        placeholder: "2569-1",
      }),
      { key: "academicYear", label: "ปีการศึกษา (พ.ศ.)", type: "number", required: true, placeholder: "2569" },
      {
        key: "semester",
        label: "ภาค",
        type: "select",
        required: true,
        select: {
          options: [
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3 (ฤดูร้อน)" },
          ],
        },
      },
      { key: "startDate", label: "วันเริ่ม", type: "date", required: true },
      { key: "endDate", label: "วันสิ้นสุด", type: "date", required: true },
    ],
    needs: [],
  },
  courses: {
    label: "รายวิชา",
    singular: "รายวิชา",
    columns: [
      { key: "code", label: "รหัส" },
      { key: "baseCode", label: "รหัสฐาน" },
      { key: "nameTh", label: "ชื่อ (ไทย)" },
      { key: "credits", label: "หน่วยกิต", format: "number" },
      { key: "creditPattern", label: "รูปแบบ" },
      { key: "departmentCode", label: "สาขา" },
    ],
    filters: [
      { key: "q", label: "ค้นหา (รหัส/ชื่อ)", type: "text" },
      { key: "baseCode", label: "รหัสฐาน", type: "text" },
      { key: "departmentCode", label: "สาขา", type: "select", select: { dataset: "departments" } },
    ],
    fields: [
      codeField("รหัสวิชา", {
        hint: "รหัสเต็มรวมรุ่น เช่น 10301111-1 · ตั้งแล้วแก้ไม่ได้",
        placeholder: "10301111-1",
      }),
      {
        key: "baseCode",
        label: "รหัสฐาน",
        type: "text",
        required: true,
        createOnly: true,
        pattern: /^\d+$/,
        patternMessage: "รหัสฐานต้องเป็นตัวเลข",
        placeholder: "10301111",
      },
      { key: "nameTh", label: "ชื่อ (ไทย)", type: "text", required: true },
      { key: "nameEn", label: "ชื่อ (อังกฤษ)", type: "text" },
      { key: "credits", label: "หน่วยกิต", type: "number", required: true },
      { key: "creditPattern", label: "รูปแบบหน่วยกิต", type: "text", placeholder: "3(2-3-5)" },
      { key: "departmentCode", label: "สาขาเจ้าของ", type: "select", select: { dataset: "departments" } },
    ],
    needs: ["departments"],
  },
  curricula: {
    label: "หลักสูตร",
    singular: "หลักสูตร",
    columns: [
      { key: "code", label: "รหัส" },
      { key: "nameTh", label: "ชื่อ (ไทย)" },
      { key: "curriculumYear", label: "ปีหลักสูตร", format: "number" },
      { key: "totalCredits", label: "หน่วยกิตรวม", format: "number" },
      { key: "departmentCode", label: "สาขา" },
    ],
    filters: [
      { key: "q", label: "ค้นหา (รหัส/ชื่อ)", type: "text" },
      { key: "departmentCode", label: "สาขา", type: "select", select: { dataset: "departments" } },
    ],
    fields: [
      codeField("รหัสหลักสูตร", { placeholder: "65304010" }),
      { key: "nameTh", label: "ชื่อ (ไทย)", type: "text", required: true },
      { key: "nameEn", label: "ชื่อ (อังกฤษ)", type: "text" },
      { key: "curriculumYear", label: "ปีหลักสูตร (พ.ศ.)", type: "number", required: true, placeholder: "2565" },
      { key: "totalCredits", label: "หน่วยกิตรวม", type: "number" },
      {
        key: "departmentCode",
        label: "สาขา",
        type: "select",
        required: true,
        select: { dataset: "departments" },
      },
    ],
    needs: ["departments"],
  },
};

/** `{ code, label }` lists the page loads for every select source. */
export type SelectOptions = Record<
  "faculties" | "buildings" | "departments",
  { value: string; label: string }[]
>;

export function optionsFor(
  source: SelectSource | undefined,
  options: SelectOptions,
): { value: string; label: string }[] {
  if (!source) return [];
  return "options" in source ? source.options : options[source.dataset];
}
