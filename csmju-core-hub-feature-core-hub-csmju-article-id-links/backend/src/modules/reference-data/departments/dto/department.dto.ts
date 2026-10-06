import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ReferenceQueryDto } from '../../common/reference-query.dto';
import {
  REFERENCE_CODE_MESSAGE,
  REFERENCE_CODE_PATTERN,
} from '../../common/reference-code';

export class QueryDepartmentsDto extends ReferenceQueryDto {
  @IsOptional()
  @IsString()
  facultyCode?: string;
}

export class CreateDepartmentDto {
  @IsString()
  @Matches(REFERENCE_CODE_PATTERN, { message: REFERENCE_CODE_MESSAGE })
  @MaxLength(50)
  code: string;

  @IsString()
  @MinLength(1)
  nameTh: string;

  @IsString()
  @MinLength(1)
  nameEn: string;

  /** รหัสคณะที่สังกัด (faculties.code) */
  @IsString()
  @MinLength(1)
  facultyCode: string;
}

/** ไม่มี code — ValidationPipe (forbidNonWhitelisted) จะตอบ 400 ถ้าส่ง code มา */
export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nameTh?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  facultyCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
