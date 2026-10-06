import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission.enum';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'any_permissions';

/** The caller must hold **every** listed permission. */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * The caller must hold **at least one** listed permission.
 *
 * Used for `:own` / `:any` pairs — the guard only decides whether the caller
 * may try, and the service then checks ownership against the real record
 * (authorization.md §4).
 */
export const AnyPermissions = (...permissions: Permission[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
