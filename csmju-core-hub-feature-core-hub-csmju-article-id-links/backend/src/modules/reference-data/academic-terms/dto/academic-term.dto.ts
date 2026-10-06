import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ReferenceQueryDto } from '../../common/reference-query.dto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD';

export class QueryAcademicTermsDto extends ReferenceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  academicYear?: number;
}

export class CreateAcademicTermDto {
  /** "<ปี พ.ศ.>-<ภาค>" ต้องตรงกับ academicYear และ semester */
  @IsString()
  @Matches(/^\d{4}-[1-3]$/, {
    message: 'code ต้องเป็น <ปี พ.ศ.>-<ภาค> เช่น 2569-1',
  })
  code: string;

  @IsInt()
  @Min(2500)
  @Max(2700)
  academicYear: number;

  @IsInt()
  @Min(1)
  @Max(3)
  semester: number;

  @Matches(DATE, { message: DATE_MESSAGE })
  startDate: string;

  @Matches(DATE, { message: DATE_MESSAGE })
  endDate: string;
}

/** ไม่มี code / isCurrent — เปลี่ยนภาคปัจจุบันผ่าน POST /:code/set-current */
export class UpdateAcademicTermDto {
  @IsOptional()
  @Matches(DATE, { message: DATE_MESSAGE })
  startDate?: string;

  @IsOptional()
  @Matches(DATE, { message: DATE_MESSAGE })
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
