import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReferenceQueryDto } from './reference-query.dto';
import { toPaginated } from './to-paginated';

describe('reference-data common', () => {
  it('toPaginated: meta.totalPages ถูกต้อง', async () => {
    const six = await toPaginated(
      { page: 1, limit: 4 },
      Promise.resolve(6),
      Promise.resolve([1, 2, 3, 4]),
      (x: number) => x,
    );
    expect(six.meta).toEqual({ total: 6, page: 1, limit: 4, totalPages: 2 });
    const none = await toPaginated(
      { page: 1, limit: 4 },
      Promise.resolve(0),
      Promise.resolve([] as number[]),
      (x: number) => x,
    );
    expect(none.meta.totalPages).toBe(0);
  });

  it('ReferenceQueryDto: ค่าเริ่มต้น และปฏิเสธ limit เกิน 100', async () => {
    const def = plainToInstance(ReferenceQueryDto, {});
    expect(def).toMatchObject({ page: 1, limit: 20, includeInactive: false });
    expect(await validate(def)).toHaveLength(0);

    const tooMany = plainToInstance(ReferenceQueryDto, { limit: '101' });
    expect((await validate(tooMany)).length).toBeGreaterThan(0);

    const inactive = plainToInstance(ReferenceQueryDto, {
      includeInactive: 'true',
    });
    expect(inactive.includeInactive).toBe(true);
  });
});
