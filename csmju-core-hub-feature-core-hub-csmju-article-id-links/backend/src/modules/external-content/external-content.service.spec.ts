import { PrismaService } from '../../database/prisma.service';
import { ExternalContentService } from './external-content.service';

describe('ExternalContentService', () => {
  let prisma: {
    hiddenExternalContent: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let service: ExternalContentService;

  beforeEach(() => {
    prisma = {
      hiddenExternalContent: {
        findMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new ExternalContentService(prisma as unknown as PrismaService);
  });

  it('lists hidden items with URL-style kinds', async () => {
    const hiddenAt = new Date('2026-09-27T09:00:00Z');
    prisma.hiddenExternalContent.findMany.mockResolvedValue([
      { kind: 'ARTICLE', externalId: 'a-1', title: 'ข่าว', hiddenAt },
      { kind: 'BANNER', externalId: 'b-1', title: 'TCAS70', hiddenAt },
    ]);

    await expect(service.listHidden()).resolves.toEqual([
      { kind: 'article', externalId: 'a-1', title: 'ข่าว', hiddenAt },
      { kind: 'banner', externalId: 'b-1', title: 'TCAS70', hiddenAt },
    ]);
  });

  it('hides by upserting, so hiding twice is not an error', async () => {
    await expect(
      service.hide('banner', 'b-1', 'TCAS70', 'user-admin'),
    ).resolves.toEqual({ kind: 'banner', externalId: 'b-1', hidden: true });

    expect(prisma.hiddenExternalContent.upsert).toHaveBeenCalledWith({
      where: { kind_externalId: { kind: 'BANNER', externalId: 'b-1' } },
      create: {
        kind: 'BANNER',
        externalId: 'b-1',
        title: 'TCAS70',
        hiddenById: 'user-admin',
      },
      update: { title: 'TCAS70' },
    });
  });

  it('shows by deleting the row, even when nothing was hidden', async () => {
    await expect(service.show('article', 'a-1')).resolves.toEqual({
      kind: 'article',
      externalId: 'a-1',
      hidden: false,
    });

    expect(prisma.hiddenExternalContent.deleteMany).toHaveBeenCalledWith({
      where: { kind: 'ARTICLE', externalId: 'a-1' },
    });
  });
});
