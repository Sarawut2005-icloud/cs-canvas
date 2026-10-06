import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Paginated } from '../../common/pagination/paginated';
import {
  CreateAnnouncementDto,
  ListAnnouncementsQuery,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

const AUTHOR = { select: { id: true, username: true, email: true } } as const;

/** What the public front page may see: no author, no image bytes. */
const PUBLIC_FIELDS = {
  id: true,
  title: true,
  content: true,
  category: true,
  publishedAt: true,
  imageUpdatedAt: true,
} as const;

/** Every read leaves the image bytes out — they are served by `getImage()`. */
const WITHOUT_IMAGE = { imageData: true } as const;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** The fields of a multer upload this service reads. */
export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

/**
 * Accepted formats, recognised by their leading bytes rather than the
 * client-supplied Content-Type, so a renamed file cannot slip through.
 */
const IMAGE_SIGNATURES: Array<{
  type: string;
  matches: (b: Buffer) => boolean;
}> = [
  {
    type: 'image/jpeg',
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: 'image/png',
    matches: (b) =>
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    type: 'image/gif',
    matches: (b) => b.subarray(0, 4).toString('ascii') === 'GIF8',
  },
  {
    type: 'image/webp',
    matches: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export function detectImageType(buffer: Buffer): string | null {
  return IMAGE_SIGNATURES.find(({ matches }) => matches(buffer))?.type ?? null;
}

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest first: published by `publishedAt`, drafts by when they were made. */
  async list(query: ListAnnouncementsQuery) {
    const where: Prisma.AnnouncementWhereInput = {
      isPublished: query.isPublished,
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { category: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        orderBy: [
          { publishedAt: { sort: 'desc', nulls: 'first' } },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        omit: WITHOUT_IMAGE,
        include: { author: AUTHOR },
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return Paginated.of(items, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      omit: WITHOUT_IMAGE,
      include: { author: AUTHOR },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    return announcement;
  }

  /* ---------------------------------------------------------------- */
  /* Public reads — published only, no author                          */
  /* ---------------------------------------------------------------- */

  /** Newest published first, for the public front page. */
  listPublished(limit: number) {
    return this.prisma.announcement.findMany({
      where: { isPublished: true },
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      take: limit,
      select: PUBLIC_FIELDS,
    });
  }

  /** A draft answers 404 exactly like a missing id. */
  async findPublished(id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, isPublished: true },
      select: PUBLIC_FIELDS,
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    return announcement;
  }

  create(dto: CreateAnnouncementDto, authorId: string) {
    const isPublished = dto.isPublished ?? false;

    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        authorId,
      },
      omit: WITHOUT_IMAGE,
      include: { author: AUTHOR },
    });
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    const current = await this.findOne(id);

    // The first publish stamps the date; unpublishing and republishing keeps
    // it, so an announcement does not jump back to the top of the list.
    const firstPublish = dto.isPublished === true && !current.publishedAt;

    return this.prisma.announcement.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        isPublished: dto.isPublished,
        ...(firstPublish ? { publishedAt: new Date() } : {}),
      },
      omit: WITHOUT_IMAGE,
      include: { author: AUTHOR },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.announcement.delete({ where: { id } });
    return { id, deleted: true };
  }

  /* ---------------------------------------------------------------- */
  /* Cover image                                                       */
  /* ---------------------------------------------------------------- */

  async setImage(id: string, file: UploadedImage | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('An image file is required');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image must be 2 MB or smaller');
    }

    const imageType = detectImageType(file.buffer);
    if (!imageType) {
      throw new BadRequestException('Image must be a JPEG, PNG, GIF or WebP');
    }

    await this.findOne(id);

    return this.prisma.announcement.update({
      where: { id },
      data: {
        imageData: new Uint8Array(file.buffer),
        imageType,
        imageUpdatedAt: new Date(),
      },
      omit: WITHOUT_IMAGE,
      include: { author: AUTHOR },
    });
  }

  async removeImage(id: string) {
    await this.findOne(id);

    return this.prisma.announcement.update({
      where: { id },
      data: { imageData: null, imageType: null, imageUpdatedAt: null },
      omit: WITHOUT_IMAGE,
      include: { author: AUTHOR },
    });
  }

  async getImage(
    id: string,
    { publishedOnly = false } = {},
  ): Promise<{ data: Uint8Array; type: string }> {
    const row = await this.prisma.announcement.findFirst({
      where: { id, ...(publishedOnly ? { isPublished: true } : {}) },
      select: { imageData: true, imageType: true },
    });

    if (!row?.imageData || !row.imageType) {
      throw new NotFoundException('Announcement image not found');
    }

    return { data: row.imageData, type: row.imageType };
  }
}
