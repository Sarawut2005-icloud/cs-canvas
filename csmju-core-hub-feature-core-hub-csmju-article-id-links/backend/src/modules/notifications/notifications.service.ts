import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PageMeta, Paginated } from '../../common/pagination/paginated';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { ListNotificationsQuery } from './dto/list-notifications.query';

const NOTIFICATION_SELECT = {
  id: true,
  title: true,
  body: true,
  link: true,
  readAt: true,
  createdAt: true,
} as const;

/**
 * A link the bell may render: a path on this site (not `//host`, and no
 * backslash, which browsers read as `/`) or an absolute http(s) URL.
 * Anything else — `javascript:`, `data:`, … — would run in the portal when
 * clicked.
 */
export function safeNotificationLink(
  link: string | null | undefined,
): string | null {
  if (!link) return null;
  const value = link.trim();
  // A loop rather than a regex range: eslint's no-control-regex rejects one.
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || code === 0x5c) return null;
  }
  if (value.startsWith('/')) return value.startsWith('//') ? null : value;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Notifications belong to one account and are only ever read by it: every
 * query is narrowed to the caller's id, and touching someone else's answers
 * 403 (authorization.md §5 — 403, not 404, for a resource that exists).
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Newest first. `meta.unread` counts the caller's unread notifications
   * overall, whatever the page — the bell's badge.
   */
  async listMine(userId: string, query: ListNotificationsQuery) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unread ? { readAt: null } : {}),
    };
    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: NOTIFICATION_SELECT,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    const page = Paginated.of(
      items.map((item) => ({
        ...item,
        link: safeNotificationLink(item.link),
      })),
      total,
      query.page,
      query.limit,
    );
    const meta: PageMeta & { unread: number } = { ...page.meta, unread };
    return new Paginated(page.items, meta);
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      select: { userId: true, readAt: true },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'You can only update your own notifications',
      );
    }
    if (!notification.readAt) {
      await this.prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }
    return { id, read: true };
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }
}
