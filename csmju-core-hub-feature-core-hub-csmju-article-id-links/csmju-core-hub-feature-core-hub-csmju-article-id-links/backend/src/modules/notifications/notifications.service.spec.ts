import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { Paginated } from '../../common/pagination/paginated';
import { PrismaService } from '../../database/prisma.service';
import {
  NotificationsService,
  safeNotificationLink,
} from './notifications.service';

function makeService() {
  const prisma = {
    notification: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest
      .fn()
      .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const service = new NotificationsService(prisma as unknown as PrismaService);
  return { service, prisma };
}

const QUERY = { page: 1, limit: 10 };

describe('NotificationsService', () => {
  it('lists only the caller’s notifications as a page, with the unread count in meta', async () => {
    const { service, prisma } = makeService();
    prisma.notification.findMany.mockResolvedValue([
      { id: 'n-1', link: '/courses' },
    ]);
    prisma.notification.count
      .mockResolvedValueOnce(12) // total
      .mockResolvedValueOnce(3); // unread

    const page = await service.listMine('user-1', { page: 2, limit: 10 });

    expect(page).toBeInstanceOf(Paginated);
    expect(page.items).toEqual([{ id: 'n-1', link: '/courses' }]);
    expect(page.meta).toEqual({
      total: 12,
      page: 2,
      limit: 10,
      totalPages: 2,
      unread: 3,
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        skip: 10,
        take: 10,
      }),
    );
    expect(prisma.notification.count).toHaveBeenLastCalledWith({
      where: { userId: 'user-1', readAt: null },
    });
  });

  it('filters to unread ones when asked', async () => {
    const { service, prisma } = makeService();
    await service.listMine('user-1', { ...QUERY, unread: true });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', readAt: null } }),
    );
  });

  it('marks the caller’s own notification read', async () => {
    const { service, prisma } = makeService();
    prisma.notification.findUnique.mockResolvedValue({
      userId: 'user-1',
      readAt: null,
    });

    await expect(service.markRead('user-1', 'n-1')).resolves.toEqual({
      id: 'n-1',
      read: true,
    });
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'n-1' } }),
    );
  });

  it('answers 403 for someone else’s notification and changes nothing', async () => {
    const { service, prisma } = makeService();
    prisma.notification.findUnique.mockResolvedValue({
      userId: 'user-2',
      readAt: null,
    });

    await expect(service.markRead('user-1', 'n-9')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('answers 404 for a notification that does not exist', async () => {
    const { service } = makeService();
    await expect(service.markRead('user-1', 'n-0')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('treats an already-read notification as success without writing', async () => {
    const { service, prisma } = makeService();
    prisma.notification.findUnique.mockResolvedValue({
      userId: 'user-1',
      readAt: new Date(),
    });

    await expect(service.markRead('user-1', 'n-1')).resolves.toEqual({
      id: 'n-1',
      read: true,
    });
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });
});

describe('safeNotificationLink', () => {
  it.each([
    ['/courses', '/courses'],
    ['/backoffice/subsystems?tab=1', '/backoffice/subsystems?tab=1'],
    ['https://csmju.com/articles/x', 'https://csmju.com/articles/x'],
    ['http://example.test/', 'http://example.test/'],
  ])('keeps %s', (link, expected) => {
    expect(safeNotificationLink(link)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//evil.example/path',
    '/\\evil.example',
    '/ok\u0000',
    'courses',
    '',
    null,
    undefined,
  ])('drops %p', (link) => {
    expect(safeNotificationLink(link)).toBeNull();
  });

  it('strips unsafe links from the list it returns', async () => {
    const { service, prisma } = makeService();
    prisma.notification.findMany.mockResolvedValue([
      { id: 'n-1', link: 'javascript:alert(1)' },
      { id: 'n-2', link: '/courses' },
    ]);

    const { items } = await service.listMine('user-1', QUERY);

    expect(items.map((i) => i.link)).toEqual([null, '/courses']);
  });
});
