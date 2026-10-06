import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ReferenceQueryDto } from '../../common/reference-query.dto';
import {
  REFERENCE_CODE_MESSAGE,
  REFERENCE_CODE_PATTERN,
} from '../../common/reference-code';

const BASE_CODE = /^\d+$/;
const BASE_CODE_MESSAGE = 'baseCode ต้องเป็นตัวเลขล้วน เช่น 10301111';

export class QueryCoursesDto extends ReferenceQueryDto {
  /** รหัสวิชาไม่รวมรุ่น (ตรงตัว) */
  @IsOptional()
  @IsString()
  baseCode?: string;

  @IsOptional()
  @IsString()
  departmentCode?: string;

  /** เฉพาะวิชาที่อยู่ในหลักสูตรนี้ */
  @IsOptional()
  @IsString()
  curriculumCode?: string;

  // q (ค้นใน code / nameTh / nameEn) มาจาก ReferenceQueryDto
}

export class CreateCourseDto {
  /** รหัสเต็มรวมรุ่น เช่น 10301111-1 */
  @IsString()
  @Matches(REFERENCE_CODE_PATTERN, { message: REFERENCE_CODE_MESSAGE })
  @MaxLength(50)
  code: string;

  @IsString()
  @Matches(BASE_CODE, { message: BASE_CODE_MESSAGE })
  @MaxLength(50)
  baseCode: string;

  @IsString()
  @MinLength(1)
  nameTh: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nameEn?: string;

  @IsInt()
  @Min(0)
  credits: number;

  /** เช่น 3(2-3-5) */
  @IsOptional()
  @IsString()
  @MinLength(1)
  creditPattern?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  departmentCode?: string;
}

/** ไม่มี code / baseCode — ValidationPipe (forbidNonWhitelisted) จะตอบ 400 ถ้าส่งมา */
export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nameTh?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nameEn?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  credits?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  creditPattern?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  departmentCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
