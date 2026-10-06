import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ReferenceQueryDto } from '../../common/reference-query.dto';
import {
  REFERENCE_CODE_MESSAGE,
  REFERENCE_CODE_PATTERN,
} from '../../common/reference-code';

export class QueryCurriculaDto extends ReferenceQueryDto {
  @IsOptional()
  @IsString()
  departmentCode?: string;
}

export class CreateCurriculumDto {
  /** รหัสหลักสูตรของมหาวิทยาลัย เช่น 65304010 */
  @IsString()
  @Matches(REFERENCE_CODE_PATTERN, { message: REFERENCE_CODE_MESSAGE })
  @MaxLength(50)
  code: string;

  @IsString()
  @MinLength(1)
  nameTh: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nameEn?: string;

  /** ปี พ.ศ. ของหลักสูตร */
  @IsInt()
  @Min(2500)
  @Max(2700)
  curriculumYear: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalCredits?: number;

  /** รหัสสาขาเจ้าของหลักสูตร (departments.code) */
  @IsString()
  @MinLength(1)
  departmentCode: string;
}

/** ไม่มี code — ValidationPipe (forbidNonWhitelisted) จะตอบ 400 ถ้าส่ง code มา */
export class UpdateCurriculumDto {
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
  @Min(2500)
  @Max(2700)
  curriculumYear?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalCredits?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  departmentCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
