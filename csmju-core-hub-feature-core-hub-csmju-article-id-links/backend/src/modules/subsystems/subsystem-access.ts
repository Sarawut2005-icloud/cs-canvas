import { UserRole } from '../users/user-role.enum';

/** The six core roles — the only valid role-mapping keys and exception roles. */
export const CORE_ROLES: readonly string[] = Object.values(UserRole);

/** Approved-or-not exception row, as stored in `subsystem_exceptions`. */
export interface ExceptionRow {
  username: string;
  role: string;
  status: string;
  updatedAt: Date;
}

/**
 * Core roles a subsystem accepts: the keys of its registry role mapping,
 * lower-cased (`{ "student": "STUDENT" }` → `['student']`). An empty or
 * malformed mapping accepts nobody.
 */
export function mappedCoreRoles(mapping: unknown): string[] {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    return [];
  }

  return Object.keys(mapping as Record<string, unknown>).map((role) =>
    role.trim().toLowerCase(),
  );
}

/**
 * The role a user has inside one subsystem (CORE_HUB_TOKEN_SCOPE 2.5): the
 * role of an APPROVED exception for (this subsystem, the user's username) if
 * there is one — the newest if several — otherwise the account role.
 *
 * Used for the SSO access check, the `role` claim of the handoff token and the
 * portal menu. Never for Core Hub's own permission checks.
 */
export function effectiveRole(
  exceptions: readonly ExceptionRow[] | undefined,
  user: { role: string; username?: string | null },
): { role: string; exception: boolean } {
  const approved = user.username
    ? (exceptions ?? [])
        .filter(
          (row) => row.status === 'APPROVED' && row.username === user.username,
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
    : undefined;

  return approved
    ? { role: approved.role.trim().toLowerCase(), exception: true }
    : { role: user.role.trim().toLowerCase(), exception: false };
}
