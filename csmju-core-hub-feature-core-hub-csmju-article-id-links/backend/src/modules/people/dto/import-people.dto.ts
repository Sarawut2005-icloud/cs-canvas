import { IsIn, IsString, MaxLength } from 'class-validator';

export const IMPORT_MODES = ['dry-run', 'commit'] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

/**
 * เนื้อไฟล์ CSV ส่งมาเป็น string ใน JSON (ไม่ใช้ multipart เพื่อไม่ต้องเพิ่ม dependency)
 * ขนาด body จำกัด 2 MB ที่ main.ts — MaxLength กันซ้ำอีกชั้นหลังผ่าน body-parser
 */
export class ImportPeopleDto {
  @IsIn(IMPORT_MODES)
  mode: ImportMode;

  @IsString()
  @MaxLength(2_000_000)
  csv: string;
}
