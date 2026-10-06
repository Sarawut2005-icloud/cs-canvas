import { SetMetadata } from '@nestjs/common';

export const SUBSYSTEM_TOKEN_ALLOWED_KEY = 'subsystemTokenAllowed';

/**
 * Lets a handoff token (one carrying `azp`) call this route or controller.
 * Every other route that uses JwtAuthGuard answers such a token with 403, so
 * a new route stays closed to subsystems until someone opts it in.
 *
 * The list is decided by the PL (CORE_HUB_TOKEN_SCOPE 2.2) — do not add a
 * route on your own. The caller's own permissions still apply as usual.
 */
export const SubsystemTokenAllowed = () =>
  SetMetadata(SUBSYSTEM_TOKEN_ALLOWED_KEY, true);
