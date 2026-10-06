import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../database/prisma.service';
import { Permission } from '../authorization/permission.enum';
import { roleHasPermission } from '../authorization/role-permissions';
import { UserRole } from './user-role.enum';
import { UserActor, UsersService } from './users.service';

const ADMIN: UserActor = { id: 'user-admin', role: 'admin' };
const OTHER_ADMIN: UserActor = { id: 'user-admin-2', role: 'admin' };
const STAFF: UserActor = { id: 'user-staff', role: 'staff' };

const ACCOUNTS: Record<string, { id: string; email: string; role: string }> = {
  [ADMIN.id]: { id: ADMIN.id, email: 'admin@core.local', role: 'admin' },
  [OTHER_ADMIN.id]: {
    id: OTHER_ADMIN.id,
    email: 'admin2@core.local',
    role: 'admin',
  },
  [STAFF.id]: { id: STAFF.id, email: 'staff@core.local', role: 'staff' },
  'user-student': {
    id: 'user-student',
    email: 'student@core.local',
    role: 'student',
  },
};

/**
 * `PATCH /users/update/:id` — who may change what (staff → admin fix).
 * The permission removal stops staff at the guard; these rules are the second
 * line in the service in case `user:update` is ever given to another role.
 */
describe('UsersService.update — account change rules', () => {
  let tx: {
    user: { update: jest.Mock; count: jest.Mock };
    session: { updateMany: jest.Mock };
  };
  let prisma: {
    user: { findUnique: jest.Mock };
    role: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: UsersService;
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    tx = {
      user: {
        update: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve({ id: where.id }),
        ),
        count: jest.fn().mockResolvedValue(2),
      },
      session: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    prisma = {
      user: {
        findUnique: jest.fn(
          ({ where }: { where: { id?: string; email?: string } }) => {
            const account = where.id ? ACCOUNTS[where.id] : undefined;
            return Promise.resolve(
              account ? { ...account, role: { name: account.role } } : null,
            );
          },
        ),
      },
      role: {
        findUnique: jest.fn(({ where }: { where: { name: string } }) =>
          Promise.resolve({ id: `role-${where.name}`, name: where.name }),
        ),
      },
      $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    service = new UsersService(prisma as unknown as PrismaService);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  const logged = (spy: jest.SpyInstance) =>
    (spy.mock.calls as unknown[][]).map(
      (call) => JSON.parse(String(call[0])) as Record<string, unknown>,
    );

  it('staff no longer holds user:update (guard answers 403 first)', () => {
    expect(roleHasPermission(UserRole.STAFF, Permission.USER_UPDATE)).toBe(
      false,
    );
    expect(roleHasPermission(UserRole.STAFF, Permission.USER_READ)).toBe(true);
    expect(roleHasPermission(UserRole.ADMIN, Permission.USER_UPDATE)).toBe(
      true,
    );
  });

  describe('a non-admin caller (if user:update is ever granted again)', () => {
    it('cannot make themselves admin', async () => {
      await expect(
        service.update(STAFF.id, { role: UserRole.ADMIN }, STAFF),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(logged(warn)[0]).toMatchObject({
        event: 'user.update_refused',
        actor: STAFF.id,
        reason: 'role-change-not-admin',
      });
    });

    it('cannot change anyone else’s role', async () => {
      await expect(
        service.update('user-student', { role: UserRole.STAFF }, STAFF),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each([
      ['password', { password: 'Taken-Over-2026' }],
      ['email', { email: 'mine@core.local' }],
      ['role', { role: UserRole.GUEST }],
    ])('cannot change an admin account’s %s', async (_field, dto) => {
      await expect(service.update(ADMIN.id, dto, STAFF)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('may still send its current role back unchanged', async () => {
      await expect(
        service.update('user-student', { role: UserRole.STUDENT }, STAFF),
      ).resolves.toBeDefined();
      expect(tx.session.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('an admin', () => {
    it('changes another account’s role and ends that account’s sessions', async () => {
      await service.update('user-student', { role: UserRole.STAFF }, ADMIN);

      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-student' },
          data: { roleId: 'role-staff' },
        }),
      );
      expect(tx.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-student', status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: expect.any(Date) as Date },
      });
      expect(logged(log)).toContainEqual({
        event: 'user.role_changed',
        actor: ADMIN.id,
        target: 'user-student',
        from: 'student',
        to: 'staff',
        revokedSessions: 2,
      });
    });

    it('cannot change their own role', async () => {
      await expect(
        service.update(ADMIN.id, { role: UserRole.STAFF }, ADMIN),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('may demote another admin while one remains', async () => {
      await expect(
        service.update(OTHER_ADMIN.id, { role: UserRole.STAFF }, ADMIN),
      ).resolves.toBeDefined();
    });

    it('cannot remove the last administrator (409, nothing written)', async () => {
      tx.user.count.mockResolvedValue(1);

      await expect(
        service.update(OTHER_ADMIN.id, { role: UserRole.STAFF }, ADMIN),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('resets a password under the password policy and ends sessions', async () => {
      await service.update(
        'user-student',
        { password: 'A-Strong-Pass-2026' },
        ADMIN,
      );

      const { data } = (
        tx.user.update.mock.calls[0] as [{ data: { passwordHash: string } }]
      )[0];
      expect(data.passwordHash).toMatch(/^\$2b\$12\$/);
      await expect(
        bcrypt.compare('A-Strong-Pass-2026', data.passwordHash),
      ).resolves.toBe(true);
      expect(tx.session.updateMany).toHaveBeenCalled();

      const lines = (log.mock.calls as unknown[][])
        .map((c) => String(c[0]))
        .join('\n');
      expect(lines).toContain('user.password_reset_by_admin');
      expect(lines).not.toContain('A-Strong-Pass-2026');
    });

    it('refuses a password that fails the policy (400)', async () => {
      await expect(
        service.update('user-student', { password: '12345678' }, ADMIN),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('changes only the e-mail without ending sessions', async () => {
      await service.update('user-student', { email: 'new@core.local' }, ADMIN);
      expect(tx.session.updateMany).not.toHaveBeenCalled();
    });
  });
});
