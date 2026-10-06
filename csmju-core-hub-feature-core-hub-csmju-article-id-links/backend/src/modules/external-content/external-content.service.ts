import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { KIND_BY_SLUG, type KindSlug } from './dto/hide-external-content.dto';

const SLUG_BY_KIND = Object.fromEntries(
  Object.entries(KIND_BY_SLUG).map(([slug, kind]) => [kind, slug]),
) as Record<(typeof KIND_BY_SLUG)[KindSlug], KindSlug>;

/**
 * csmju.com news and banners hidden from the public front page. Nothing is
 * sent to csmju.com — the front page filters these ids out of what it reads.
 */
@Injectable()
export class ExternalContentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every hidden item, newest first. Public: ids and titles only. */
  async listHidden() {
    const rows = await this.prisma.hiddenExternalContent.findMany({
      select: { kind: true, externalId: true, title: true, hiddenAt: true },
      orderBy: { hiddenAt: 'desc' },
    });
    return rows.map((row) => ({ ...row, kind: SLUG_BY_KIND[row.kind] }));
  }

  /** Idempotent: hiding an already hidden item only refreshes its title. */
  async hide(
    slug: KindSlug,
    externalId: string,
    title: string,
    userId: string,
  ) {
    const kind = KIND_BY_SLUG[slug];
    await this.prisma.hiddenExternalContent.upsert({
      where: { kind_externalId: { kind, externalId } },
      create: { kind, externalId, title, hiddenById: userId },
      update: { title },
    });
    return { kind: slug, externalId, hidden: true as const };
  }

  /** Idempotent: showing an item that is not hidden is not an error. */
  async show(slug: KindSlug, externalId: string) {
    await this.prisma.hiddenExternalContent.deleteMany({
      where: { kind: KIND_BY_SLUG[slug], externalId },
    });
    return { kind: slug, externalId, hidden: false as const };
  }
}
