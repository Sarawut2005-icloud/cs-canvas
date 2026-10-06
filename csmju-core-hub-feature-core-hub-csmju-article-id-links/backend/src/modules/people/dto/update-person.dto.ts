import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { PersonStatus } from '../../../../generated/prisma/client';

/**
 * PATCH /people/:personCode — รับได้เฉพาะ 3 ช่องนี้
 * ValidationPipe (forbidNonWhitelisted) ตอบ 400 ถ้าส่งช่องอื่นมา (แพทเทิร์นเดียวกับ UpdateRoomDto)
 */
export class UpdatePersonDto {
  @IsOptional()
  @IsEnum(PersonStatus)
  status?: PersonStatus;

  @IsOptional()
  @IsEmail()
  universityEmail?: string;

  /** อีเมลบัญชี Core Hub (users.email) ที่จะผูกกับบุคคลนี้ */
  @IsOptional()
  @IsEmail()
  coreUserEmail?: string;
}
