import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from '../authorization/permissions.guard';
import { PrismaService } from '../../database/prisma.service';
import {
  SubsystemExceptionsController,
  SubsystemsController,
} from './subsystems.controller';

// @nestjs/mapped-types v12 ships ESM only, which CommonJS jest cannot load
// (the same reason `test:e2e` is broken — backend/README.md §11). This spec
// only reads the controller's decorator metadata, so a stand-in is enough.
jest.mock('@nestjs/mapped-types', () => ({
  PartialType: (base: new () => object) => class extends base {},
}));

type Role = 'student' | 'alumni' | 'staff' | 'admin';

/** One staff account holds subsystem:create through a per-account grant. */
const GRANTED_STAFF = 'user-granted-staff';
const grants = {
  userPermissionGrant: {
    findMany: jest.fn(
      ({
        where,
      }: {
        where: { userId: string; permission?: { in: string[] } };
      }) =>
        Promise.resolve(
          where.userId === GRANTED_STAFF &&
            (where.permission?.in ?? []).includes('subsystem:create')
            ? [{ permission: 'subsystem:create' }]
            : [],
        ),
    ),
  },
};

const guard = new PermissionsGuard(
  new Reflector(),
  grants as unknown as PrismaService,
);

function allows(
  controller:
    typeof SubsystemsController | typeof SubsystemExceptionsController,
  method: string,
  role: Role,
  userId = `user-${role}`,
): Promise<boolean> {
  const handler = (controller.prototype as unknown as Record<string, unknown>)[
    method
  ];
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: userId, role } }),
    }),
  } as unknown as ExecutionContext;

  return Promise.resolve(guard.canActivate(context));
}

/**
 * Route → roles that pass PermissionsGuard on the role alone. Everyone else
 * gets 403. `:own` routes also pass for staff; the service then narrows them
 * to the staff member's own subsystems (see subsystems.rules.spec.ts).
 * `create` is admin-only by role — owners get it through a grant (below).
 */
const MATRIX: Array<[string, Role[]]> = [
  ['create', ['admin']],
  ['standardsVersionList', ['staff', 'admin']],
  ['listAllChangeRequests', ['admin']],
  ['createChangeRequest', ['staff', 'admin']],
  ['listChangeRequests', ['staff', 'admin']],
  ['approveChangeRequest', ['admin']],
  ['rejectChangeRequest', ['admin']],
  ['cancelChangeRequest', ['staff', 'admin']],
  ['history', ['staff', 'admin']],
  ['list', ['staff', 'admin']],
  ['summary', ['staff', 'admin']],
  ['directory', ['student', 'alumni', 'staff', 'admin']],
  ['findAll', ['admin']],
  ['getById', ['staff', 'admin']],
  ['checkHealth', ['staff', 'admin']],
  ['update', ['staff', 'admin']],
  ['delete', ['admin']],
  ['approve', ['admin']],
  ['reject', ['admin']],
  ['resubmit', ['staff', 'admin']],
  ['activate', ['admin']],
  ['deactivate', ['admin']],
  ['suspend', ['admin']],
  ['getRoleMapping', ['staff', 'admin']],
  ['updateRoleMapping', ['staff', 'admin']],
  ['createException', ['staff', 'admin']],
  ['getExceptions', ['staff', 'admin']],
  ['approveException', ['admin']],
  ['rejectException', ['admin']],
];

const ROLES: Role[] = ['student', 'alumni', 'staff', 'admin'];

describe('SubsystemsController permissions', () => {
  it('declares a permission on every route (no route is open by accident)', async () => {
    const routes = Object.getOwnPropertyNames(
      SubsystemsController.prototype,
    ).filter((name) => name !== 'constructor');

    expect(routes.sort()).toEqual(MATRIX.map(([route]) => route).sort());

    for (const route of routes) {
      expect(await allows(SubsystemsController, route, 'student')).toBe(
        MATRIX.find(([name]) => name === route)![1].includes('student'),
      );
    }
  });

  describe.each(MATRIX)('%s', (route, allowed) => {
    it.each(ROLES)('%s', async (role) => {
      expect(await allows(SubsystemsController, route, role)).toBe(
        allowed.includes(role),
      );
    });
  });

  it('lets a staff account register only with a subsystem:create grant', async () => {
    expect(await allows(SubsystemsController, 'create', 'staff')).toBe(false);
    expect(
      await allows(SubsystemsController, 'create', 'staff', GRANTED_STAFF),
    ).toBe(true);
    // A grant is only looked up for grantable permissions.
    expect(
      await allows(SubsystemsController, 'approve', 'staff', GRANTED_STAFF),
    ).toBe(false);
    expect(
      await allows(SubsystemsController, 'create', 'student', GRANTED_STAFF),
    ).toBe(true);
  });

  it('never consults grants when the role already decides', async () => {
    grants.userPermissionGrant.findMany.mockClear();
    await allows(SubsystemsController, 'create', 'admin');
    await allows(SubsystemsController, 'list', 'staff');
    await allows(SubsystemsController, 'delete', 'staff');
    expect(grants.userPermissionGrant.findMany).not.toHaveBeenCalled();
  });

  it('keeps the exception review queue to admins', async () => {
    expect(await allows(SubsystemExceptionsController, 'list', 'admin')).toBe(
      true,
    );
    expect(await allows(SubsystemExceptionsController, 'list', 'staff')).toBe(
      false,
    );
    expect(await allows(SubsystemExceptionsController, 'list', 'student')).toBe(
      false,
    );
  });
});
