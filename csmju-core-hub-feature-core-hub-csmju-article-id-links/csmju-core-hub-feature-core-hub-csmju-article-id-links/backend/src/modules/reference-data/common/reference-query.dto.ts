import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** query กลางของทุกชุดข้อมูลอ้างอิง — DTO ของแต่ละชุด extends ตัวนี้ */
export class ReferenceQueryDto {
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

  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  includeInactive: boolean = false;

  /** ค้นจากรหัสหรือชื่อ (ไม่สนตัวพิมพ์เล็ก-ใหญ่) — ชุดข้อมูลกำหนดเองว่าค้นคอลัมน์ไหน */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** กรองสถานะตรง ๆ (`true` = ใช้งาน · `false` = ปิดใช้งาน) — มีค่าแล้ว includeInactive ไม่มีผล */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : value,
  )
  @IsBoolean()
  isActive?: boolean;
}
