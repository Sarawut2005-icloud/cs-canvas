import { Paginated } from '../../../common/pagination/paginated';

export interface PageQuery {
  page: number;
  limit: number;
}

/** skip/take สำหรับ Prisma */
export function pageArgs(query: PageQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

/** ห่อผล count + findMany เป็น Paginated พร้อม meta ที่ถูกต้อง แล้วแปลงแต่ละแถวด้วย toItem */
export async function toPaginated<R, T>(
  query: PageQuery,
  count: Promise<number>,
  rows: Promise<R[]>,
  toItem: (row: R) => T,
): Promise<Paginated<T>> {
  const [total, items] = await Promise.all([count, rows]);
  return new Paginated(items.map(toItem), {
    total,
    page: query.page,
    limit: query.limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  });
}
