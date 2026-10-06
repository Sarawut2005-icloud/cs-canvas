import {
  IsBoolean,
  IsNumber,
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

export class QueryBuildingsDto extends ReferenceQueryDto {}

export class CreateBuildingDto {
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

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

/** ไม่มี code — ValidationPipe (forbidNonWhitelisted) จะตอบ 400 ถ้าส่ง code มา */
export class UpdateBuildingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nameTh?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nameEn?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
