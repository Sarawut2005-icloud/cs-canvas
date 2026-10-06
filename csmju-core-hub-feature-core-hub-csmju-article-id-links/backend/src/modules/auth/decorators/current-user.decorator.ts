import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** The user `JwtStrategy.validate()` attached to the request. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  /** Display handle (student code for MJU SSO accounts); may be null. */
  username?: string | null;
  role: string;
  sessionId: string;
  /** Current profile picture — `GET /api/v1/images/:id/file`. */
  profileImageId: string | null;
  /**
   * Registry name of the subsystem when the request carries a handoff
   * token; absent for Core Hub's own web token.
   */
  azp?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>()
      .user,
);
