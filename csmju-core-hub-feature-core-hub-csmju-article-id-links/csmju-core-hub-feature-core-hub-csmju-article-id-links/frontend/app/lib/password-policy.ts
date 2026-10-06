/**
 * Live checklist for the change-password form. The Core API decides —
 * backend/src/modules/users/password-policy.ts is the source of truth; keep
 * the two in step. "Not the same as the current password" can only be
 * checked there, against the stored hash; so is the ban on guessable
 * patterns such as the old CSV import default, which is not listed here.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
/** bcrypt ignores everything past 72 bytes; Thai letters take 3 bytes each. */
const BCRYPT_MAX_BYTES = 72;

export type PasswordRule = { label: string; ok: (password: string) => boolean };

export const PASSWORD_RULES: PasswordRule[] = [
  {
    label: `ยาว ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} ตัวอักษร`,
    ok: (p) => {
      const length = [...p].length;
      return (
        length >= PASSWORD_MIN_LENGTH &&
        length <= PASSWORD_MAX_LENGTH &&
        new TextEncoder().encode(p).length <= BCRYPT_MAX_BYTES
      );
    },
  },
  {
    label: "มีตัวพิมพ์ใหญ่ (A–Z) อย่างน้อย 1 ตัว",
    ok: (p) => /[A-Z]/.test(p),
  },
];
