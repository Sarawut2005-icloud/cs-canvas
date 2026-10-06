import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from '../authorization/permissions.guard';
import { ExternalContentController } from './external-content.controller';

type Role = 'student' | 'alumni' | 'staff' | 'admin';

const guard = new PermissionsGuard(new Reflector());

function allows(method: string, role: Role): Promise<boolean> {
  const handler = (
    ExternalContentController.prototype as unknown as Record<string, unknown>
  )[method];
  const context = {
    getHandler: () => handler,
    getClass: () => ExternalContentController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  } as unknown as ExecutionContext;

  return Promise.resolve(guard.canActivate(context));
}

const ROLES: Role[] = ['student', 'alumni', 'staff', 'admin'];

/** Route → roles that pass PermissionsGuard. `null` = public, no guard. */
const MATRIX: Array<[string, Role[] | null]> = [
  ['listHidden', null],
  ['hide', ['admin']],
  ['show', ['admin']],
];

describe('ExternalContentController permissions', () => {
  it('covers every route', () => {
    const routes = Object.getOwnPropertyNames(
      ExternalContentController.prototype,
    ).filter((name) => name !== 'constructor');

    expect(routes.sort()).toEqual(MATRIX.map(([route]) => route).sort());
  });

  it('leaves only the hidden list public', () => {
    for (const [route, allowed] of MATRIX) {
      const handler = (
        ExternalContentController.prototype as unknown as Record<string, object>
      )[route];
      const guards = Reflect.getMetadata('__guards__', handler) as
        unknown[] | undefined;
      expect(Boolean(guards?.length)).toBe(allowed !== null);
    }
  });

  describe.each(MATRIX.filter(([, allowed]) => allowed !== null))(
    '%s',
    (route, allowed) => {
      it.each(ROLES)('%s', async (role) => {
        expect(await allows(route, role)).toBe(allowed!.includes(role));
      });
    },
  );
});
