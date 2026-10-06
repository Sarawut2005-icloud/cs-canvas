import { Permission } from './permission.enum';
import { ROLE_PERMISSIONS, roleHasPermission } from './role-permissions';
import { UserRole } from '../users/user-role.enum';

/**
 * Permissions an admin may give one account on top of its role
 * (`user_permission_grants`) — a closed list. Everything else comes from the
 * role alone. Grants never go into the token: the guard and services read
 * them from the database on each request, so a revoke takes effect at once.
 */
export const GRANTABLE_PERMISSIONS = [Permission.SUBSYSTEM_CREATE] as const;

export type GrantablePermission = (typeof GRANTABLE_PERMISSIONS)[number];

export function isGrantablePermission(
  value: string,
): value is GrantablePermission {
  return (GRANTABLE_PERMISSIONS as readonly string[]).includes(value);
}

/** The table the lookups below need — PrismaService, or a transaction. */
export interface PermissionGrantStore {
  userPermissionGrant: {
    findMany(args: {
      where: { userId: string; permission?: { in: string[] } };
      select: { permission: true };
    }): Promise<{ permission: string }[]>;
  };
}

/** The grantable permissions this account holds through grants. */
export async function grantedPermissions(
  store: PermissionGrantStore,
  userId: string,
  only: readonly string[] = GRANTABLE_PERMISSIONS,
): Promise<GrantablePermission[]> {
  const wanted = only.filter(isGrantablePermission);
  if (wanted.length === 0) return [];

  const rows = await store.userPermissionGrant.findMany({
    where: { userId, permission: { in: wanted } },
    select: { permission: true },
  });
  // A row for a permission that has since left the list grants nothing.
  return rows.map((row) => row.permission).filter(isGrantablePermission);
}

/** Role permissions plus grants — what the account may really do. */
export async function effectivePermissions(
  store: PermissionGrantStore,
  user: { id: string; role: string },
): Promise<Permission[]> {
  const fromRole = ROLE_PERMISSIONS[user.role as UserRole] ?? [];
  const granted = await grantedPermissions(store, user.id);
  return [...new Set<Permission>([...fromRole, ...granted])];
}

/** `roleHasPermission`, plus a grant for the grantable permissions. */
export async function userHasPermission(
  store: PermissionGrantStore,
  user: { id: string; role: string },
  permission: Permission,
): Promise<boolean> {
  if (roleHasPermission(user.role, permission)) return true;
  if (!isGrantablePermission(permission)) return false;
  return (await grantedPermissions(store, user.id, [permission])).length > 0;
}
