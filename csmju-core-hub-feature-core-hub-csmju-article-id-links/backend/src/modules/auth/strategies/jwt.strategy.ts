import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';

import { UsersService } from '../../users/users.service';
import { SessionService } from '../sessions/session.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import {
  ACCESS_AUDIENCE,
  TOKEN_ISSUER,
  parseDurationToMs,
} from '../token-types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /** Longest life an access or handoff token can have, in seconds. */
  private readonly maxLifetimeSec: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
  ) {
    const publicKeyPath =
      configService.get<string>('jwt.publicKeyPath') ?? 'keys/jwt-public.pem';

    const publicKey = readFileSync(publicKeyPath, 'utf8');

    if (!publicKey) {
      throw new Error('JWT public key is not configured');
    }

    // A refresh token (aud=core-hub-refresh) fails the audience check here.
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
      issuer: TOKEN_ISSUER,
      audience: ACCESS_AUDIENCE,
    });

    this.maxLifetimeSec =
      parseDurationToMs(configService.get<string>('jwt.expiresIn') ?? '15m') /
      1000;
  }

  async validate(payload: JwtPayload) {
    // Refresh tokens signed before the audience split carry aud=csmju2030
    // and live 7 days. No access or handoff token lives longer than
    // jwt.expiresIn, so anything longer is one of those and is refused.
    if (
      typeof payload.exp !== 'number' ||
      typeof payload.iat !== 'number' ||
      payload.exp - payload.iat > this.maxLifetimeSec
    ) {
      throw new UnauthorizedException('Invalid token');
    }

    const session = await this.sessionService.getSession(payload.sid);

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (session.status !== 'ACTIVE') {
      throw new UnauthorizedException('Session is not active');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      // Shown in the UI instead of the e-mail when set (e.g. student code
      // for MJU SSO accounts). Not part of the token contract.
      username: user.username,
      // Always the account role from the database — never the token's
      // `role`, which on a handoff token may be a subsystem exception.
      role: user.role.name,
      sessionId: session.id,
      profileImageId: user.profileImageId,
      // Set only on a handoff token; JwtAuthGuard limits such a token to
      // the routes marked @SubsystemTokenAllowed().
      ...(typeof payload.azp === 'string' && { azp: payload.azp }),
    };
  }
}
