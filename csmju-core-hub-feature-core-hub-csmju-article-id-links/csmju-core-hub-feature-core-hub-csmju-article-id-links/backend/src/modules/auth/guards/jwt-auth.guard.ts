import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { SUBSYSTEM_TOKEN_ALLOWED_KEY } from '../decorators/subsystem-token-allowed.decorator';

/**
 * Authenticates the Bearer token, then applies the subsystem-token allowlist:
 * a handoff token (`azp` set) reaches only routes marked
 * `@SubsystemTokenAllowed()`; anything else answers 403 FORBIDDEN.
 *
 * The allowlist lives here rather than in a separate global guard because
 * this guard is attached per controller and global guards run before it —
 * this way every route that authenticates is covered, including ones added
 * later, and public routes (no JwtAuthGuard) are untouched.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger('JwtAuthGuard');

  constructor(private readonly reflector: Reflector) {
    super();
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    const authenticated = super.handleRequest<TUser>(
      err,
      user,
      info,
      context,
      status,
    );

    const azp = (authenticated as { azp?: unknown } | undefined)?.azp;

    if (typeof azp === 'string') {
      const allowed = this.reflector.getAllAndOverride<boolean>(
        SUBSYSTEM_TOKEN_ALLOWED_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (!allowed) {
        const request = context.switchToHttp().getRequest<Request>();
        // Path only: the query string may hold personal data, and the
        // token itself is never logged.
        this.logger.warn(
          JSON.stringify({
            event: 'auth.subsystem_token_refused',
            azp,
            method: request.method,
            path: request.originalUrl.split('?')[0],
          }),
        );

        throw new ForbiddenException(
          'This endpoint cannot be called with a subsystem token',
        );
      }
    }

    return authenticated;
  }
}
