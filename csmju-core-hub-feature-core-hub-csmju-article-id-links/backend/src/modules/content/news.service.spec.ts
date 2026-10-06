import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NewsService } from './news.service';

interface FindManyArgs {
  where: { publishedOn?: { lte?: Date } };
  orderBy: unknown;
  skip: number;
  take: number;
}

/** mock เฉพาะเมธอดที่ service เรียกใช้ (ไม่ใช้ any) */
function makeService() {
  const prisma = {
    newsArticle: {
      count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(0),
      findMany: jest
        .fn<Promise<unknown[]>, [FindManyArgs]>()
        .mockResolvedValue([]),
      findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    },
  };
  const service = new NewsService(prisma as unknown as PrismaService);
  return { service, prisma };
}

const ARTICLE = {
  id: 'news-1',
  title: 'ทดสอบประกาศ',
  category: 'ทั่วไป',
  publishedOn: new Date('2026-08-25T00:00:00.000Z'),
  content: 'เนื้อหา',
  externalUrl: null,
  imageUrl: null,
  createdAt: new Date('2026-08-25T01:00:00.000Z'),
  updatedAt: new Date('2026-08-25T01:00:00.000Z'),
  department: { code: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' },
};

describe('NewsService', () => {
  it('รายการ: กรองเฉพาะที่ถึงวันเผยแพร่แล้ว เรียงใหม่→เก่า และคืน meta', async () => {
    const { service, prisma } = makeService();
    prisma.newsArticle.count.mockResolvedValue(8);
    prisma.newsArticle.findMany.mockResolvedValue([ARTICLE]);

    const result = await service.list({ page: 2, limit: 3 });

    const args = prisma.newsArticle.findMany.mock.calls[0][0];
    expect(args.where.publishedOn?.lte).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual([
      { publishedOn: 'desc' },
      { createdAt: 'desc' },
    ]);
    expect(args.skip).toBe(3);
    expect(args.take).toBe(3);

    expect(result.meta).toEqual({ total: 8, page: 2, limit: 3, totalPages: 3 });
    expect(result.items[0]).toMatchObject({
      id: 'news-1',
      publishedOn: '2026-08-25',
      createdAt: '2026-08-25T01:00:00.000Z',
      department: { code: 'CS' },
    });
  });

  it('รายการว่าง: data [] และ total 0 (ไม่ใช่ 404)', async () => {
    const { service } = makeService();
    const result = await service.list({ page: 1, limit: 20 });
    expect(result.items).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(result.meta.totalPages).toBe(0);
  });

  it('รายชิ้น: ไม่พบหรือยังไม่ถึงวันเผยแพร่ → 404', async () => {
    const { service, prisma } = makeService();
    prisma.newsArticle.findFirst.mockResolvedValue(null);
    await expect(service.get('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const where = (
      prisma.newsArticle.findFirst.mock.calls[0][0] as {
        where: { id: string; publishedOn: { lte: Date } };
      }
    ).where;
    expect(where.id).toBe('missing');
    expect(where.publishedOn.lte).toBeInstanceOf(Date);
  });

  it('รายชิ้น: แปลงวันที่เป็น YYYY-MM-DD และ ISO', async () => {
    const { service, prisma } = makeService();
    prisma.newsArticle.findFirst.mockResolvedValue(ARTICLE);
    const item = await service.get('news-1');
    expect(item.publishedOn).toBe('2026-08-25');
    expect(item.updatedAt).toBe('2026-08-25T01:00:00.000Z');
  });
});
