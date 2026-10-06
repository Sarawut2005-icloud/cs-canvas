import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { Permission } from '../authorization/permission.enum';
import {
  GRANTABLE_PERMISSIONS,
  effectivePermissions,
  userHasPermission,
} from '../authorization/permission-grants';
import { UsersService } from './users.service';

// Mock data only.
const ADMIN = { id: 'user-admin', role: 'admin' };

function fakeStore(grants: { userId: string; permission: string }[] = []) {
  const rows = [...grants];
  return {
    rows,
    prisma: {
      user: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(
            where.id === 'user-missing' ? null : { id: where.id },
          ),
        ),
      },
      userPermissionGrant: {
        findMany: jest.fn(
          ({
            where,
          }: {
            where: { userId: string; permission?: { in: string[] } };
          }) =>
            Promise.resolve(
              rows
                .filter(
                  (r) =>
                    r.userId === where.userId &&
                    (!where.permission ||
                      where.permission.in.includes(r.permission)),
                )
                .map(({ permission }) => ({ permission })),
            ),
        ),
        upsert: jest.fn(
          ({
            create,
          }: {
            create: { userId: string; permission: string; grantedById: string };
          }) => {
            if (
              !rows.some(
                (r) =>
                  r.userId === create.userId &&
                  r.permission === create.permission,
              )
            ) {
              rows.push(create);
            }
            return Promise.resolve({
              permission: create.permission,
              grantedById: create.grantedById,
              createdAt: new Date(),
            });
          },
        ),
        deleteMany: jest.fn(
          ({ where }: { where: { userId: string; permission: string } }) => {
            const before = rows.length;
            for (let i = rows.length - 1; i >= 0; i--) {
              if (
                rows[i].userId === where.userId &&
                rows[i].permission === where.permission
              ) {
                rows.splice(i, 1);
              }
            }
            return Promise.resolve({ count: before - rows.length });
          },
        ),
      },
    },
  };
}

describe('per-account permission grants', () => {
  it('the grantable list is closed: subsystem:create only', () => {
    expect([...GRANTABLE_PERMISSIONS]).toEqual([Permission.SUBSYSTEM_CREATE]);
  });

  it('effective permissions = role + grants (R12 /auth/me)', async () => {
    const { prisma } = fakeStore([
      { userId: 'user-team', permission: 'subsystem:create' },
    ]);

    const team = await effectivePermissions(prisma, {
      id: 'user-team',
      role: 'staff',
    });
    const plain = await effectivePermissions(prisma, {
      id: 'user-plain',
      role: 'staff',
    });

    expect(team).toContain('subsystem:create');
    expect(team).toContain('subsystem:update:own');
    expect(plain).not.toContain('subsystem:create');
  });

  it('a grant row for a permission outside the list grants nothing', async () => {
    const { prisma } = fakeStore([
      { userId: 'user-team', permission: 'subsystem:review' },
    ]);

    await expect(
      userHasPermission(
        prisma,
        { id: 'user-team', role: 'staff' },
        Permission.SUBSYSTEM_REVIEW,
      ),
    ).resolves.toBe(false);
    expect(
      await effectivePermissions(prisma, { id: 'user-team', role: 'staff' }),
    ).not.toContain('subsystem:review');
  });
});

describe('UsersService.grantPermission / revokePermission', () => {
  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });
  afterEach(() => log.mockRestore());

  it('R12 · grant, then revoke — /auth/me follows; logged with ids only', async () => {
    const store = fakeStore();
    const service = new UsersService(store.prisma as unknown as PrismaService);
    const target = { id: 'user-team', role: 'staff' };

    await service.grantPermission('user-team', 'subsystem:create', ADMIN);
    expect(await service.effectivePermissions(target)).toContain(
      'subsystem:create',
    );
    // Granting twice keeps one row.
    await service.grantPermission('user-team', 'subsystem:create', ADMIN);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({ grantedById: ADMIN.id });

    await service.revokePermission('user-team', 'subsystem:create', ADMIN);
    expect(await service.effectivePermissions(target)).not.toContain(
      'subsystem:create',
    );

    const events = log.mock.calls.map(
      ([line]) => JSON.parse(line as string) as Record<string, unknown>,
    );
    expect(events.map((e) => e.event)).toEqual([
      'user.permission_granted',
      'user.permission_granted',
      'user.permission_revoked',
    ]);
    expect(JSON.stringify(events)).not.toMatch(/@/); // no e-mail
  });

  it('refuses a permission outside the list (400) and an unknown account (404)', async () => {
    const store = fakeStore();
    const service = new UsersService(store.prisma as unknown as PrismaService);

    await expect(
      service.grantPermission('user-team', 'subsystem:review', ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.grantPermission('user-missing', 'subsystem:create', ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(store.rows).toHaveLength(0);
  });
});
