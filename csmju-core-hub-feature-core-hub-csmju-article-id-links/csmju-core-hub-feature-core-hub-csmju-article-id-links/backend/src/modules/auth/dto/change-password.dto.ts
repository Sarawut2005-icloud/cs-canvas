import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * ตรวจแค่รูปร่าง — กติการหัสผ่านใหม่อยู่ที่ users/password-policy.ts
 * เพดาน 256 กันคำขอที่ส่งข้อความยาวมากมาให้ bcrypt เปลือง CPU
 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  newPassword!: string;
}
