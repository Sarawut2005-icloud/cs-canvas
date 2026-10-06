import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

import { SubsystemsService } from '../subsystems/subsystems.service';
import { effectiveRole, mappedCoreRoles } from '../subsystems/subsystem-access';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ACCESS_AUDIENCE, SIGNING_KEY_ID, TOKEN_ISSUER } from './token-types';

/** Identity attached to the request by JwtAuthGuard / JwtStrategy. */
export interface AuthenticatedCoreUser {
  id: string;
  email: string;
  /** Account role from the database. */
  role: string;
  /** Matched against `subsystem_exceptions.username`. */
  username?: string | null;
  sessionId: string;
}

export interface SsoHandoff {
  subsystem: {
    id: string;
    name: string;
    displayName: string;
  };
  callbackUrl: string;
  redirectUrl: string;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  state?: string;
}

/**
 * Central SSO handoff.
 *
 * The Core Hub stays the only identity provider: it reuses the existing RS256
 * signing key (`kid = core-hub-2026`) and the user's web session (`sid`), and
 * hands the subsystem a handoff token through the callback URL that the
 * Subsystem Registry has on file. The handoff token is the access token
 * contract plus `azp` (the subsystem's registry name), which limits what it
 * may call on Core Hub itself (JwtAuthGuard), and its `role` is the user's
 * effective role in that subsystem (an approved exception, if any).
 *
 * Responsibility split:
 *   Core Hub  - who this user is, and WHICH subsystems they may enter
 *               (the core roles listed in the registry role mapping);
 *   Subsystem - what that user may DO once inside (its own permissions).
 */
@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);

  constructor(
    private readonly subsystemsService: SubsystemsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async authorize(
    user: AuthenticatedCoreUser,
    options: { subsystem: string; callbackUrl?: string; state?: string },
  ): Promise<SsoHandoff> {
    // Registry lookup - throws NotFoundException (404) for an unknown subsystem.
    const subsystem = await this.subsystemsService.findByIdentifier(
      options.subsystem,
    );

    if (subsystem.approvalStatus !== 'APPROVED') {
      throw new ConflictException(
        `Subsystem is not approved for SSO (approvalStatus: ${subsystem.approvalStatus})`,
      );
    }

    if (subsystem.status !== 'ACTIVE') {
      throw new ConflictException(
        `Subsystem is not active (status: ${subsystem.status})`,
      );
    }

    // Core Hub decides who may enter a subsystem. The registry role mapping
    // already declares which Core Hub roles the subsystem accepts, so its keys
    // are the access list - a role that is not mapped is refused here, before
    // any token is issued or any redirect happens. An empty mapping accepts
    // nobody. The role checked is the effective one: an approved exception
    // for this user in this subsystem replaces the account role.
    const allowedCoreRoles = mappedCoreRoles(subsystem.defaultRoleMapping);
    const effective = effectiveRole(subsystem.exceptions, user);

    if (!allowedCoreRoles.includes(effective.role)) {
      this.logger.warn(
        JSON.stringify({
          event: 'sso.role_not_allowed',
          subsystem: subsystem.name,
          sub: user.id,
          coreRole: user.role,
          effectiveRole: effective.role,
          allowedCoreRoles,
        }),
      );

      throw new ForbiddenException(
        `Your Core Hub role has no access to ${subsystem.name}`,
      );
    }

    const registeredCallback = this.parseHttpUrl(subsystem.callbackUrl);

    if (!registeredCallback) {
      throw new BadRequestException(
        'Subsystem has no valid registered callback URL',
      );
    }

    // The callback was valid when it was registered, but the rule can change
    // under it: with ALLOW_LOCALHOST_CALLBACKS switched off, a production API
    // must stop sending browsers (and tokens) to http://localhost at once.
    // Checked before a token is signed. The URL itself is never logged.
    if (
      this.subsystemsService.registrableUrlProblem(
        'callbackUrl',
        registeredCallback.href,
      ) !== null
    ) {
      this.logger.warn(
        JSON.stringify({
          event: 'sso.callback_not_allowed',
          subsystem: subsystem.name,
          sub: user.id,
        }),
      );

      throw new ConflictException(
        'Subsystem callback URL is not allowed on this server (plain http needs ALLOW_LOCALHOST_CALLBACKS)',
      );
    }

    // An explicitly requested callback must match the registered one exactly.
    // This is what prevents open redirects: the destination always comes from
    // the registry, never from the caller.
    if (options.callbackUrl !== undefined) {
      const requestedCallback = this.parseHttpUrl(options.callbackUrl);

      if (
        !requestedCallback ||
        this.normalize(requestedCallback) !== this.normalize(registeredCallback)
      ) {
        this.logger.warn(
          JSON.stringify({
            event: 'sso.callback_rejected',
            subsystem: subsystem.name,
            sub: user.id,
          }),
        );

        throw new BadRequestException(
          'callback_url is not registered for this subsystem',
        );
      }
    }

    if (effective.exception) {
      this.logger.log(
        JSON.stringify({
          event: 'sso.exception_applied',
          subsystem: subsystem.name,
          sub: user.id,
          coreRole: user.role,
          effectiveRole: effective.role,
        }),
      );
    }

    // Same `sid` as the web session: signing out of Core Hub ends the
    // subsystem token too (2.4).
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: effective.role,
      sid: user.sessionId,
      iss: TOKEN_ISSUER,
      aud: ACCESS_AUDIENCE,
      azp: subsystem.name,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: (this.configService.get<string>('jwt.expiresIn') ??
        '15m') as JwtSignOptions['expiresIn'],
      keyid: SIGNING_KEY_ID,
    });

    const redirectUrl = new URL(registeredCallback.toString());
    redirectUrl.searchParams.set('access_token', accessToken);
    redirectUrl.searchParams.set('token_type', 'Bearer');

    const expiresIn = this.tokenLifetimeSeconds(accessToken);
    redirectUrl.searchParams.set('expires_in', String(expiresIn));

    if (options.state !== undefined) {
      redirectUrl.searchParams.set('state', options.state);
    }

    this.logger.log(
      JSON.stringify({
        event: 'sso.handoff_issued',
        subsystem: subsystem.name,
        sub: user.id,
        sid: user.sessionId,
      }),
    );

    return {
      subsystem: {
        id: subsystem.id,
        name: subsystem.name,
        displayName: subsystem.displayName,
      },
      callbackUrl: registeredCallback.toString(),
      redirectUrl: redirectUrl.toString(),
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      ...(options.state !== undefined && { state: options.state }),
    };
  }

  /** Accepts http/https URLs only; anything else (javascript:, data:, ...) is rejected. */
  private parseHttpUrl(value: string | null | undefined): URL | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }

    let url: URL;

    try {
      url = new URL(value.trim());
    } catch {
      return null;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    // A callback carrying its own query string or fragment is not accepted:
    // the comparison below must stay an exact match against the registry.
    return url;
  }

  /** protocol + host + path (trailing slash and query/fragment normalised away). */
  private normalize(url: URL): string {
    const path = url.pathname.replace(/\/+$/, '');

    return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${path}${url.search}${url.hash}`;
  }

  private tokenLifetimeSeconds(token: string): number {
    const decoded: unknown = this.jwtService.decode(token);
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !('exp' in decoded) ||
      !('iat' in decoded)
    ) {
      return 0;
    }
    const exp = decoded.exp;
    const iat = decoded.iat;
    if (typeof exp !== 'number' || typeof iat !== 'number') {
      return 0;
    }
    return exp - iat;
  }
}
