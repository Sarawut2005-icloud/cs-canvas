import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { Paginated } from '../../common/pagination/paginated';
import { NewsQueryDto } from './dto/news-query.dto';

const SELECT = {
  id: true,
  title: true,
  category: true,
  publishedOn: true,
  content: true,
  externalUrl: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { code: true, nameTh: true } },
} satisfies Prisma.NewsArticleSelect;

type Row = Prisma.NewsArticleGetPayload<{ select: typeof SELECT }>;

/** วันที่แบบ YYYY-MM-DD (คอลัมน์ @db.Date) */
function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** เที่ยงคืน UTC ของวันนี้ — ใช้เทียบกับ published_on ซึ่งเป็น date ล้วน */
function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function toNewsItem(row: Row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    publishedOn: toDateOnly(row.publishedOn),
    content: row.content,
    externalUrl: row.externalUrl,
    imageUrl: row.imageUrl,
    department: row.department,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * ประกาศ (news_articles) — อ่านอย่างเดียวในเฟสนี้
 *
 * model ไม่มีฟิลด์สถานะเผยแพร่ (ตัดสินใจ M5): ถือว่า "เผยแพร่แล้ว" เมื่อ
 * published_on <= วันนี้ (UTC) — ประกาศที่ลงวันที่ล่วงหน้าจะยังไม่แสดง
 */
@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  private published(): Prisma.NewsArticleWhereInput {
    return { publishedOn: { lte: todayUtc() } };
  }

  async list(query: NewsQueryDto) {
    const where = this.published();
    const [total, rows] = await Promise.all([
      this.prisma.newsArticle.count({ where }),
      this.prisma.newsArticle.findMany({
        where,
        select: SELECT,
        orderBy: [{ publishedOn: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return Paginated.of(rows.map(toNewsItem), total, query.page, query.limit);
  }

  async get(id: string) {
    const row = await this.prisma.newsArticle.findFirst({
      where: { id, ...this.published() },
      select: SELECT,
    });
    if (!row) throw new NotFoundException('ไม่พบประกาศ');
    return toNewsItem(row);
  }
}
