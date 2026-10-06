import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from '../authorization/permissions.guard';
import { AnnouncementsController } from './announcements.controller';

type Role = 'student' | 'alumni' | 'staff' | 'admin';

const guard = new PermissionsGuard(new Reflector());

function allows(method: string, role: Role): Promise<boolean> {
  const handler = (
    AnnouncementsController.prototype as unknown as Record<string, unknown>
  )[method];
  const context = {
    getHandler: () => handler,
    getClass: () => AnnouncementsController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  } as unknown as ExecutionContext;

  return Promise.resolve(guard.canActivate(context));
}

/** Route → roles that pass PermissionsGuard. Everyone else gets 403. */
const MATRIX: Array<[string, Role[]]> = [
  ['list', ['staff', 'admin']],
  ['getById', ['staff', 'admin']],
  ['create', ['staff', 'admin']],
  ['update', ['staff', 'admin']],
  ['delete', ['admin']],
  ['getImage', ['staff', 'admin']],
  ['setImage', ['staff', 'admin']],
  ['removeImage', ['staff', 'admin']],
];

const ROLES: Role[] = ['student', 'alumni', 'staff', 'admin'];

describe('AnnouncementsController permissions', () => {
  it('declares a permission on every route (no route is open by accident)', () => {
    const routes = Object.getOwnPropertyNames(
      AnnouncementsController.prototype,
    ).filter((name) => name !== 'constructor');

    expect(routes.sort()).toEqual(MATRIX.map(([route]) => route).sort());
  });

  describe.each(MATRIX)('%s', (route, allowed) => {
    it.each(ROLES)('%s', async (role) => {
      expect(await allows(route, role)).toBe(allowed.includes(role));
    });
  });
});
