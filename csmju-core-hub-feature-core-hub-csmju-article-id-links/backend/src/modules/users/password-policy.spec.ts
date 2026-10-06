import {
  GUESSABLE_PASSWORD_MESSAGE,
  passwordPolicyViolations,
} from './password-policy';

describe('passwordPolicyViolations', () => {
  it('ผ่าน: 8 ตัวขึ้นไปและมีตัวพิมพ์ใหญ่', () => {
    expect(passwordPolicyViolations('Abcdefgh')).toEqual([]);
    expect(passwordPolicyViolations('MyNewPass2026!')).toEqual([]);
  });

  it('สั้นกว่า 8 ตัว', () => {
    expect(passwordPolicyViolations('Abcdefg')).toEqual([
      'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร',
    ]);
  });

  it('ไม่มีตัวพิมพ์ใหญ่', () => {
    expect(passwordPolicyViolations('abcdefgh1')).toEqual([
      'รหัสผ่านต้องมีตัวพิมพ์ใหญ่ (A–Z) อย่างน้อย 1 ตัว',
    ]);
  });

  it('ยาวเกิน 64 ตัว', () => {
    expect(passwordPolicyViolations('A'.repeat(65))).toEqual([
      'รหัสผ่านยาวเกินไป (ไม่เกิน 64 ตัวอักษร)',
    ]);
    expect(passwordPolicyViolations('A'.repeat(64))).toEqual([]);
  });

  it('ไม่ถึง 64 ตัวแต่เกิน 72 byte (อักษรไทย) → ยาวเกินไป', () => {
    // 1 + 25 × 3 byte = 76 byte, 26 ตัวอักษร
    expect(passwordPolicyViolations('A' + 'ก'.repeat(25))).toEqual([
      'รหัสผ่านยาวเกินไป (ไม่เกิน 64 ตัวอักษร)',
    ]);
  });

  it('รูปแบบรหัสเริ่มต้นเดิม CSMJU@<รหัส> ถูกปฏิเสธทุกตัวพิมพ์ ด้วยข้อความกลาง ๆ', () => {
    const initial = GUESSABLE_PASSWORD_MESSAGE;
    expect(passwordPolicyViolations('CSMJU@9900000001')).toEqual([initial]);
    expect(passwordPolicyViolations('Csmju@9900000001')).toEqual([initial]);
    // ต่อท้ายด้วยอย่างอื่นถือเป็นรหัสใหม่
    expect(passwordPolicyViolations('CSMJU@9900000001x')).toEqual([]);
  });

  it('ผิดหลายข้อ → คืนครบทุกข้อ', () => {
    expect(passwordPolicyViolations('abc')).toHaveLength(2);
  });
});
