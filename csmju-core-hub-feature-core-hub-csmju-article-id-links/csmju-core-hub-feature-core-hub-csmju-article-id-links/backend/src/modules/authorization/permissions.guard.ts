import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Permission } from './permission.enum';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from './permissions.decorator';
import { ROLE_PERMISSIONS } from './role-permissions';
import { grantedPermissions, isGrantablePermission } from './permission-grants';
import { UserRole } from '../users/user-role.enum';
import { PrismaService } from '../../database/prisma.service';

interface AuthenticatedUser {
  id?: string;
  role?: UserRole;
}

/**
 * Role permissions decide almost every route without touching the database.
 * Only when the role lacks a permission that may be granted per account
 * (`GRANTABLE_PERMISSIONS` — today `subsystem:create`) does the guard look
 * the account's grants up; the answer is then a promise.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    // Optional so the metadata specs can build the guard without a database;
    // without it a grant can never be found, so the guard only fails closed.
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      targets,
    );
    const anyOfPermissions = this.reflector.getAllAndOverride<Permission[]>(
      ANY_PERMISSIONS_KEY,
      targets,
    );

    const needsAll = !!requiredPermissions?.length;
    const needsAny = !!anyOfPermissions?.length;

    if (!needsAll && !needsAny) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    const user = request.user;

    if (!user?.role) {
      return false;
    }

    const userPermissions = ROLE_PERMISSIONS[user.role];

    if (!userPermissions) {
      return false;
    }

    const missingAll = needsAll
      ? requiredPermissions.filter((p) => !userPermissions.includes(p))
      : [];
    const anySatisfied =
      !needsAny || anyOfPermissions.some((p) => userPermissions.includes(p));

    if (missingAll.length === 0 && anySatisfied) {
      return true;
    }

    // What a grant would still have to supply — all of it must be grantable.
    const missingAny = anySatisfied
      ? []
      : anyOfPermissions.filter(isGrantablePermission);
    if (
      !missingAll.every(isGrantablePermission) ||
      (!anySatisfied && missingAny.length === 0) ||
      !user.id ||
      !this.prisma
    ) {
      return false;
    }

    return this.passesWithGrants(this.prisma, user.id, missingAll, missingAny);
  }

  private async passesWithGrants(
    prisma: PrismaService,
    userId: string,
    missingAll: Permission[],
    missingAny: Permission[],
  ): Promise<boolean> {
    const granted = await grantedPermissions(prisma, userId, [
      ...missingAll,
      ...missingAny,
    ]);
    const has = (p: Permission) => (granted as Permission[]).includes(p);

    return (
      missingAll.every(has) && (missingAny.length === 0 || missingAny.some(has))
    );
  }
}
