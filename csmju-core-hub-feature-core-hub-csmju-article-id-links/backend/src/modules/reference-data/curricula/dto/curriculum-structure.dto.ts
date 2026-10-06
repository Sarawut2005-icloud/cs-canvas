import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CurriculumCategory } from '../../../../../generated/prisma/client';

/**
 * เขียนโครงสร้างหลักสูตรและแผนการเรียนจากหน้าหลังบ้าน (reference:manage)
 * รายการในโครงสร้างไม่ใช่ข้อมูลอ้างอิงที่ระบบย่อยเก็บ code จึงลบได้ (PM 5 ต.ค. 2569 ข้อ 2.6)
 */

export const CURRICULUM_CATEGORIES = Object.values(CurriculumCategory);

/** ชั้นปีในแผน 1–8 (ปกติ 1–4) · ภาค 1 2 และ 3 = ภาคฤดูร้อน */
const MAX_YEAR = 8;
const MAX_SEMESTER = 3;

// ---------- กลุ่มวิชา ----------

export class CreateCourseGroupDto {
  @IsIn(CURRICULUM_CATEGORIES)
  category: CurriculumCategory;

  /** หมวด/กลุ่มหลัก เช่น "หมวดวิชาเฉพาะ" */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  parentNameTh: string;

  /** ชื่อกลุ่มวิชา — ไม่ซ้ำในหลักสูตรเดียวกัน */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nameTh: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  listedCredits?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  availableCourseCount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCourseGroupDto {
  @IsOptional()
  @IsIn(CURRICULUM_CATEGORIES)
  category?: CurriculumCategory;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  parentNameTh?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nameTh?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  listedCredits?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  availableCourseCount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

// ---------- รายวิชาในหลักสูตร ----------

/** field ที่แก้ได้ของรายวิชาในหลักสูตร — ใช้ร่วมกันระหว่างเพิ่มและแก้ */
class CurriculumCourseFields {
  /** กลุ่มวิชาในหลักสูตรเดียวกัน · null = ไม่อยู่กลุ่มใด (เช่น สหกิจ) */
  @IsOptional()
  @IsUUID()
  courseGroupId?: string | null;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  /** วิชาในกลุ่มเดียวกันให้เลือกเรียน 1 วิชา เช่น "Y4S1" */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  choiceGroup?: string | null;

  /** นับหน่วยกิตในแผนไหม (ทางเลือกอื่นในกลุ่มเลือก 1 = false) */
  @IsOptional()
  @IsBoolean()
  isCountedInPlan?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  planNote?: string | null;

  /** ปีและภาคในแผนต้องมาคู่กัน — null ทั้งคู่ = ไม่อยู่ในแผน */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_YEAR)
  recommendedYear?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SEMESTER)
  recommendedSemester?: number | null;
}

export class AddCurriculumCourseDto extends CurriculumCourseFields {
  /** รหัสวิชาเต็ม (courses.code) */
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  courseCode: string;

  @IsIn(CURRICULUM_CATEGORIES)
  category: CurriculumCategory;
}

/** ไม่มี courseCode — เปลี่ยนวิชาให้ลบแล้วเพิ่มใหม่ */
export class UpdateCurriculumCourseDto extends CurriculumCourseFields {
  @IsOptional()
  @IsIn(CURRICULUM_CATEGORIES)
  category?: CurriculumCategory;
}

// ---------- เกณฑ์หน่วยกิตต่อหมวด ----------

export class PutCreditRuleDto {
  @IsInt()
  @Min(0)
  @Max(300)
  minCredits: number;
}

// ---------- ช่องวิชาเลือกในแผนการเรียน ----------

export class CreatePlanSlotDto {
  @IsIn(CURRICULUM_CATEGORIES)
  category: CurriculumCategory;

  @IsInt()
  @Min(1)
  @Max(MAX_YEAR)
  recommendedYear: number;

  @IsInt()
  @Min(1)
  @Max(MAX_SEMESTER)
  recommendedSemester: number;

  @IsInt()
  @Min(1)
  @Max(20)
  slotCount: number;

  @IsInt()
  @Min(0)
  @Max(30)
  creditsPerSlot: number;

  /** ชื่อช่องตามแผน เช่น "วิชาเอกเลือก" — ไม่ซ้ำในภาคเดียวกัน */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label: string;

  @IsOptional()
  @IsUUID()
  courseGroupId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class UpdatePlanSlotDto {
  @IsOptional()
  @IsIn(CURRICULUM_CATEGORIES)
  category?: CurriculumCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_YEAR)
  recommendedYear?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SEMESTER)
  recommendedSemester?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  slotCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  creditsPerSlot?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsUUID()
  courseGroupId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
