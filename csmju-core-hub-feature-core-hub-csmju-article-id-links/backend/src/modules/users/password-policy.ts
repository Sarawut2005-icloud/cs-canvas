/**
 * กติการหัสผ่านใหม่ (เปลี่ยนรหัส และตั้งรหัสผ่าน MJU SSO) — แก้ที่นี่ที่เดียว
 * frontend (app/lib/password-policy.ts) แสดงกติกาชุดเดียวกันให้ผู้ใช้เห็นก่อนส่ง
 * แต่ตัวที่ตัดสินจริงคือไฟล์นี้
 *
 * - ยาว 8–64 ตัวอักษร
 * - มีตัวพิมพ์ใหญ่ A–Z อย่างน้อย 1 ตัว
 * - ห้ามเป็นรูปแบบรหัสเริ่มต้นเดิม `CSMJU@<รหัสนักศึกษา>` ที่ CSV import เคยตั้ง
 *   (ผ่านสองข้อบนอยู่แล้วจึงต้องห้ามแยก · ข้อความตอบกลับเป็นกลาง ๆ ไม่บอกรูปแบบ)
 * - ไม่เกิน 72 byte — bcrypt ตัดส่วนที่เกินทิ้งเงียบ ๆ รหัสยาวสองชุดที่ขึ้นต้น
 *   เหมือนกันจะผ่านได้ทั้งคู่ (อักษรไทยใช้ 3 byte ต่อตัว จึงต้องตรวจ byte ด้วย)
 *
 * "ห้ามซ้ำรหัสปัจจุบัน" ต้องเทียบกับ hash จึงอยู่ใน UsersService.changePassword
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
const BCRYPT_MAX_BYTES = 72;

/** รูปแบบรหัสผ่านเริ่มต้นเดิมของบัญชีนักศึกษา — ใครรู้รหัสนักศึกษาก็เดาได้ */
const INITIAL_PASSWORD_PATTERN = /^csmju@\d+$/i;

export const GUESSABLE_PASSWORD_MESSAGE =
  'รหัสผ่านนี้คาดเดาได้ง่ายเกินไป กรุณาตั้งรหัสผ่านอื่น';

/** คืนรายการข้อที่ไม่ผ่าน (ข้อความภาษาไทย) — ว่าง = ผ่าน */
export function passwordPolicyViolations(password: string): string[] {
  const problems: string[] = [];
  const length = [...password].length;

  if (length < PASSWORD_MIN_LENGTH)
    problems.push(`รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`);
  if (
    length > PASSWORD_MAX_LENGTH ||
    Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES
  )
    problems.push(
      `รหัสผ่านยาวเกินไป (ไม่เกิน ${PASSWORD_MAX_LENGTH} ตัวอักษร)`,
    );
  if (!/[A-Z]/.test(password))
    problems.push('รหัสผ่านต้องมีตัวพิมพ์ใหญ่ (A–Z) อย่างน้อย 1 ตัว');
  if (INITIAL_PASSWORD_PATTERN.test(password))
    problems.push(GUESSABLE_PASSWORD_MESSAGE);

  return problems;
}
