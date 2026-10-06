import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RoomType } from '../../../../../generated/prisma/client';
import { ReferenceQueryDto } from '../../common/reference-query.dto';
import {
  REFERENCE_CODE_MESSAGE,
  REFERENCE_CODE_PATTERN,
} from '../../common/reference-code';

export class QueryRoomsDto extends ReferenceQueryDto {
  @IsOptional()
  @IsString()
  facultyCode?: string;

  /** กรองตามอาคาร (buildings.code) */
  @IsOptional()
  @IsString()
  buildingCode?: string;

  @IsOptional()
  @IsEnum(RoomType)
  roomType?: RoomType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;
}

export class CreateRoomDto {
  @IsString()
  @Matches(REFERENCE_CODE_PATTERN, { message: REFERENCE_CODE_MESSAGE })
  @MaxLength(50)
  code: string;

  @IsString()
  @MinLength(1)
  nameTh: string;

  /** รหัสอาคาร (เพิ่มจากสเปก เพราะ Core Hub มีตารางอาคารอยู่แล้ว) */
  @IsString()
  buildingCode: string;

  @IsInt()
  floor: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsEnum(RoomType)
  roomType: RoomType;

  @IsOptional()
  @IsString()
  facultyCode?: string;
}

/** ไม่มี code — ValidationPipe (forbidNonWhitelisted) จะตอบ 400 ถ้าส่ง code มา */
export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nameTh?: string;

  @IsOptional()
  @IsString()
  buildingCode?: string;

  @IsOptional()
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsEnum(RoomType)
  roomType?: RoomType;

  @IsOptional()
  @IsString()
  facultyCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
