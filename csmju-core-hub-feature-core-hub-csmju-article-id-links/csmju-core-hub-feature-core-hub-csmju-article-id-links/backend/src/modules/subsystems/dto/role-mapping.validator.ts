import { ValidateBy, ValidationOptions } from 'class-validator';

import { CORE_ROLES } from '../subsystem-access';

/**
 * Same rule as `/sso/authorize` on the web: 1–64 characters, lower-case
 * letters and digits in words joined by single hyphens (`a--b`, `x-` fail).
 */
export const SUBSYSTEM_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SUBSYSTEM_NAME_MAX = 64;

export function isRoleMapping(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value as Record<string, unknown>);

  return (
    entries.length > 0 &&
    entries.every(
      ([coreRole, subsystemRole]) =>
        CORE_ROLES.includes(coreRole) &&
        typeof subsystemRole === 'string' &&
        subsystemRole.trim().length > 0,
    )
  );
}

/**
 * A registry role mapping: at least one key, every key a core role in lower
 * case, every value a non-empty subsystem role. An empty mapping would let
 * nobody in through SSO while looking like "no restriction", so it is refused
 * (400 VALIDATION_ERROR through the ValidationPipe).
 */
export function IsRoleMapping(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isRoleMapping',
      validator: {
        validate: isRoleMapping,
        defaultMessage: () =>
          `defaultRoleMapping must have at least one key, every key one of ${CORE_ROLES.join(', ')} (lower case) and every value a non-empty string`,
      },
    },
    options,
  );
}
