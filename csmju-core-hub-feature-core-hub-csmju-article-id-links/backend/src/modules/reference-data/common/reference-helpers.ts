/** Prisma unique violation (code ซ้ำ) */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

/** วันที่แบบ YYYY-MM-DD (สเปก D10) */
export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → Date (เที่ยงคืน UTC ให้ตรงกับคอลัมน์ @db.Date) */
export function fromDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * เงื่อนไข isActive ของ list: ค่าเริ่มต้นเฉพาะที่ใช้งาน · includeInactive=true ทั้งหมด ·
 * isActive=true/false เลือกฝั่งเดียว (หน้า backoffice ใช้ดู "เฉพาะที่ปิดใช้งาน")
 */
export function activeWhere(query: {
  includeInactive: boolean;
  isActive?: boolean;
}): { isActive?: boolean } {
  if (query.isActive !== undefined) return { isActive: query.isActive };
  return query.includeInactive ? {} : { isActive: true };
}

/**
 * Free-text filter of a list (`?q=`): any of `fields` contains the text,
 * case-insensitively. Empty or missing `q` filters nothing.
 */
export function textWhere<F extends string>(
  q: string | undefined,
  fields: readonly F[],
): { OR?: Partial<Record<F, { contains: string; mode: 'insensitive' }>>[] } {
  const text = q?.trim();
  if (!text) return {};
  return {
    OR: fields.map(
      (field) =>
        ({ [field]: { contains: text, mode: 'insensitive' } }) as Partial<
          Record<F, { contains: string; mode: 'insensitive' }>
        >,
    ),
  };
}
