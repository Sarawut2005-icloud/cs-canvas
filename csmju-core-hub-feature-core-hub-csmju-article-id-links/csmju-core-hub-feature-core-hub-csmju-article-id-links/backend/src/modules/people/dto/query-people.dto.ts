import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const PERSON_TYPES = ['STUDENT', 'STAFF'] as const;
export const PERSON_STATUSES = ['ACTIVE', 'INACTIVE', 'GRADUATED'] as const;
export const PERSON_STATUS_FILTERS = [...PERSON_STATUSES, 'ALL'] as const;

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

/** ตัวกรองรายชื่อ — ใช้ร่วมกันระหว่าง list (แบ่งหน้า) และ export (ทั้งชุด) */
export class PeopleFilterDto {
  @IsOptional()
  @Transform(upper)
  @IsIn(PERSON_TYPES)
  personType?: (typeof PERSON_TYPES)[number];

  /** ค่าเริ่มต้นเฉพาะ ACTIVE — ส่ง ALL เพื่อดูทั้งหมด */
  @IsOptional()
  @Transform(upper)
  @IsIn(PERSON_STATUS_FILTERS)
  status: (typeof PERSON_STATUS_FILTERS)[number] = 'ACTIVE';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  entryYear?: number;

  @IsOptional()
  @IsString()
  departmentCode?: string;

  /** ค้นจากรหัสบุคคลหรือชื่อ */
  @IsOptional()
  @IsString()
  q?: string;
}

export class QueryPeopleDto extends PeopleFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

/** GET /people/export — ตัวกรองเดียวกับ list แต่ไม่แบ่งหน้า */
export class ExportPeopleDto extends PeopleFilterDto {}

export class QueryAdviseesDto {
  @IsOptional()
  @Transform(upper)
  @IsIn(PERSON_STATUS_FILTERS)
  status: (typeof PERSON_STATUS_FILTERS)[number] = 'ACTIVE';
}
