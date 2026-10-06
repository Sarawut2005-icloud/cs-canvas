import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import {
  AnnouncementsService,
  MAX_IMAGE_BYTES,
  detectImageType,
} from './announcements.service';

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBPVP8 '),
]);

describe('AnnouncementsService', () => {
  let prisma: {
    announcement: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: AnnouncementsService;

  const echo = jest.fn(({ data }: { data: object }) =>
    Promise.resolve({ id: 'a-1', ...data }),
  );

  beforeEach(() => {
    prisma = {
      announcement: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(echo),
        update: jest.fn(echo),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    service = new AnnouncementsService(prisma as unknown as PrismaService);
  });

  /** `data` passed to the first `create` / `update` call. */
  const sent = (mock: jest.Mock) =>
    (mock.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;

  const base = { title: 'หัวข้อ', content: 'เนื้อหา', category: 'ทั่วไป' };

  it('creates a draft without a publish date by default', async () => {
    await service.create(base, 'user-001');

    expect(sent(prisma.announcement.create)).toMatchObject({
      isPublished: false,
      publishedAt: null,
      authorId: 'user-001',
    });
  });

  it('stamps publishedAt when created as published', async () => {
    await service.create({ ...base, isPublished: true }, 'user-001');

    expect(sent(prisma.announcement.create).publishedAt).toBeInstanceOf(Date);
  });

  it('stamps publishedAt on the first publish', async () => {
    prisma.announcement.findUnique.mockResolvedValue({
      id: 'a-1',
      publishedAt: null,
    });

    await service.update('a-1', { isPublished: true });

    expect(sent(prisma.announcement.update).publishedAt).toBeInstanceOf(Date);
  });

  it('keeps the original publishedAt when republishing', async () => {
    prisma.announcement.findUnique.mockResolvedValue({
      id: 'a-1',
      publishedAt: new Date('2026-09-01T00:00:00Z'),
    });

    await service.update('a-1', { isPublished: true });

    expect(sent(prisma.announcement.update)).not.toHaveProperty('publishedAt');
  });

  it('answers 404 for an unknown announcement', async () => {
    prisma.announcement.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { title: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.delete('missing')).rejects.toThrow(NotFoundException);
    expect(prisma.announcement.delete).not.toHaveBeenCalled();
  });

  describe('cover image', () => {
    beforeEach(() => {
      prisma.announcement.findUnique.mockResolvedValue({ id: 'a-1' });
    });

    it('recognises formats by their leading bytes', () => {
      expect(detectImageType(PNG)).toBe('image/png');
      expect(detectImageType(JPEG)).toBe('image/jpeg');
      expect(detectImageType(Buffer.from('GIF89a'))).toBe('image/gif');
      expect(detectImageType(WEBP)).toBe('image/webp');
      expect(detectImageType(Buffer.from('<svg></svg>'))).toBeNull();
    });

    it('stores a valid image with its detected type', async () => {
      await service.setImage('a-1', { buffer: PNG, size: PNG.length });

      expect(sent(prisma.announcement.update)).toMatchObject({
        imageType: 'image/png',
      });
      expect(sent(prisma.announcement.update).imageUpdatedAt).toBeInstanceOf(
        Date,
      );
    });

    it('rejects a missing file, a non-image and an oversized file', async () => {
      await expect(service.setImage('a-1', undefined)).rejects.toThrow(
        BadRequestException,
      );
      const svg = Buffer.from('<svg></svg>');
      await expect(
        service.setImage('a-1', { buffer: svg, size: svg.length }),
      ).rejects.toThrow('JPEG, PNG, GIF or WebP');
      await expect(
        service.setImage('a-1', { buffer: PNG, size: MAX_IMAGE_BYTES + 1 }),
      ).rejects.toThrow('2 MB');
      expect(prisma.announcement.update).not.toHaveBeenCalled();
    });

    it('clears all image fields on remove', async () => {
      await service.removeImage('a-1');

      expect(sent(prisma.announcement.update)).toEqual({
        imageData: null,
        imageType: null,
        imageUpdatedAt: null,
      });
    });
  });

  describe('public reads', () => {
    type Select = { select: Record<string, boolean> };

    it('lists only published announcements, without the author', async () => {
      await service.listPublished(5);

      const args = (
        prisma.announcement.findMany.mock.calls[0] as [
          Select & { where: object; take: number },
        ]
      )[0];
      expect(args.where).toEqual({ isPublished: true });
      expect(args.take).toBe(5);
      expect(args.select).not.toHaveProperty('authorId');
      expect(args.select).not.toHaveProperty('author');
      expect(args.select).not.toHaveProperty('imageData');
    });

    it('answers 404 for a draft', async () => {
      prisma.announcement.findFirst.mockResolvedValue(null);

      await expect(service.findPublished('draft-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.announcement.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'draft-1', isPublished: true },
        }),
      );
    });

    it('serves a cover image only when published is required and met', async () => {
      prisma.announcement.findFirst.mockResolvedValue(null);

      await expect(
        service.getImage('draft-1', { publishedOnly: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.announcement.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'draft-1', isPublished: true },
        }),
      );
    });
  });
});
