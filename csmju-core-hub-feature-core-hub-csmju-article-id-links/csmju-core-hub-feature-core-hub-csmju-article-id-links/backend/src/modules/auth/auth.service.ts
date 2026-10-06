import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';

import { AuthMethod } from '../../../generated/prisma/client';
import { RateLimitStore } from '../../common/rate-limit/rate-limit.store';
import { TooManyRequestsException } from '../../common/rate-limit/too-many-requests';
import type { RateWindow } from '../../config/configuration';
import { UsersService } from '../users/users.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SessionService } from './sessions/session.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import {
  ACCESS_AUDIENCE,
  REFRESH_AUDIENCE,
  SIGNING_KEY_ID,
  TOKEN_ISSUER,
  parseDurationToMs,
} from './token-types';

/**
 * A password may be set without the current one only on a session opened
 * through MJU SSO this recently (or when the account has no password yet).
 */
export const MJU_REAUTH_WINDOW_MS = 10 * 60 * 1000;

/** Same answer for every refusal of a signed-in person who left the registry. */
const INACTIVE_MESSAGE = 'This account can no longer sign in';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly rateLimits: RateLimitStore,
  ) {}

  /**
   * Wrong passwords per email: after `limit` failures inside the window the
   * email answers 429 - even with the right password - until the oldest
   * failure ages out. A success clears the count.
   *
   * Counted per email rather than per address, so spreading a guessing run
   * over many addresses buys nothing. The price is that anyone can lock an
   * account for the window by failing on purpose; with 10 tries per 15
   * minutes that is accepted (SSO_FIX_HANDOFF 5.9).
   */
  private get lockout(): RateWindow {
    return (
      this.configService.get<RateWindow>('rateLimit.loginLockout') ?? {
        limit: 10,
        windowSec: 15 * 60,
      }
    );
  }

  private lockoutKey(email: string): string {
    return `login-failure:${email.trim().toLowerCase()}`;
  }

  private assertNotLockedOut(email: string): void {
    const wait = this.rateLimits.retryAfter(this.lockoutKey(email), [
      this.lockout,
    ]);
    if (wait !== null) {
      throw new TooManyRequestsException(
        wait,
        'Too many failed sign-in attempts, please try again later',
      );
    }
  }

  private recordFailure(email: string): UnauthorizedException {
    this.rateLimits.charge(this.lockoutKey(email), [this.lockout]);
    return new UnauthorizedException('Invalid credentials');
  }

  /**
   * Signs the web access token (`aud=csmju2030`, 15 minutes) and the refresh
   * token (`aud=core-hub-refresh`, 7 days) for the same session. The refresh
   * token's own audience is what stops it standing in for an access token.
   */
  private signTokenPair(
    user: {
      id: string;
      email: string;
      role: { name: string };
    },
    sessionId: string,
  ) {
    const claims = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
      sid: sessionId,
      iss: TOKEN_ISSUER,
    };

    const access: JwtPayload = { ...claims, aud: ACCESS_AUDIENCE };
    const refresh: JwtPayload = { ...claims, aud: REFRESH_AUDIENCE };

    return {
      accessToken: this.jwtService.sign(access, {
        expiresIn: (this.configService.get<string>('jwt.expiresIn') ??
          '15m') as JwtSignOptions['expiresIn'],
        keyid: SIGNING_KEY_ID,
      }),
      refreshToken: this.jwtService.sign(refresh, {
        expiresIn: (this.configService.get<string>('jwt.refreshExpiresIn') ??
          '7d') as JwtSignOptions['expiresIn'],
        keyid: SIGNING_KEY_ID,
      }),
    };
  }

  async login(email: string, password: string) {
    // Checked before the database and bcrypt, so a locked email costs nothing.
    this.assertNotLockedOut(email);

    const user = await this.usersService.findByEmail(email);

    // An unknown email counts too: otherwise the lockout would tell an
    // attacker which addresses have accounts. SSO-only accounts have no
    // local password and are refused the same way, so the answer does not
    // reveal how an account signs in.
    if (!user || !user.passwordHash) {
      throw this.recordFailure(email);
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      throw this.recordFailure(email);
    }

    // Only after the password matched, so the answer never tells a guesser
    // anything about the registry.
    if ((await this.usersService.linkedPersonStatus(user.id)) === 'INACTIVE') {
      this.logger.warn(
        JSON.stringify({ event: 'auth.login_person_inactive', sub: user.id }),
      );
      throw new ForbiddenException(INACTIVE_MESSAGE);
    }

    this.rateLimits.clear(this.lockoutKey(email), [this.lockout]);

    return this.issueSession(user, AuthMethod.PASSWORD);
  }

  /**
   * Opens a session for an already-authenticated user and returns the token
   * pair — shared by password login and MJU SSO sign-in so both produce the
   * same tokens, session record and refresh rotation. The method is kept on
   * the session row, not in the token (the JWT contract is fixed).
   */
  async issueSession(
    user: {
      id: string;
      email: string;
      role: { name: string };
    },
    authMethod: AuthMethod,
  ) {
    const sessionId = this.sessionService.createSessionId();

    const { accessToken, refreshToken } = this.signTokenPair(user, sessionId);

    const refreshTokenHash = this.hashToken(refreshToken);

    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';

    const sessionExpiresAt = new Date(
      Date.now() + parseDurationToMs(refreshExpiresIn),
    );

    await this.sessionService.createSession(
      sessionId,
      user.id,
      sessionExpiresAt,
      refreshTokenHash,
      authMethod,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    try {
      // Only a refresh token gets past this line. An access or handoff token
      // (aud=csmju2030) fails here with 401 before the session is read, so
      // sending one cannot trip the reuse check below and revoke the session.
      const payload = this.jwtService.verify<JwtPayload>(
        refreshTokenDto.refresh_token,
        { audience: REFRESH_AUDIENCE, issuer: TOKEN_ISSUER },
      );

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

      const incomingRefreshTokenHash = this.hashToken(
        refreshTokenDto.refresh_token,
      );

      if (incomingRefreshTokenHash !== session.refreshTokenHash) {
        await this.sessionService.revokeSession(session.id, payload.sub);

        throw new UnauthorizedException('Refresh token reuse detected');
      }

      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Someone who left the registry keeps a session for at most the life
      // of the access token already issued.
      if (
        (await this.usersService.linkedPersonStatus(user.id)) === 'INACTIVE'
      ) {
        await this.sessionService.revokeSession(session.id, user.id);
        this.logger.warn(
          JSON.stringify({
            event: 'auth.refresh_person_inactive',
            sub: user.id,
            sid: session.id,
          }),
        );
        throw new ForbiddenException(INACTIVE_MESSAGE);
      }

      const { accessToken, refreshToken: newRefreshToken } = this.signTokenPair(
        user,
        session.id,
      );

      const rotated = await this.sessionService.updateRefreshTokenHash(
        session.id,
        this.hashToken(newRefreshToken),
        session.refreshTokenHash,
      );

      if (!rotated) {
        throw new UnauthorizedException('Refresh token reuse detected');
      }

      return {
        access_token: accessToken,
        refresh_token: newRefreshToken,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new UnauthorizedException('Invalid refresh token');
    }
  }
  async logout(sessionId: string, userId: string) {
    const revoked = await this.sessionService.revokeSession(sessionId, userId);

    if (!revoked) {
      throw new UnauthorizedException('Session not found');
    }

    return {
      message: 'Logout successful',
    };
  }

  /**
   * ผู้ใช้เปลี่ยนรหัสผ่านของตัวเอง แล้วออกจากระบบทุกเครื่อง (รวมเครื่องนี้)
   *
   * รหัสปัจจุบันที่ผิดนับรวมกับ lockout ของ login (ต่ออีเมลเดียวกัน) —
   * เดาสลับระหว่างสองทางก็ไม่ได้จำนวนครั้งเพิ่ม และถูกล็อกแล้วก็ถูกทั้งสองทาง
   * log มีแค่เหตุการณ์กับ id ห้ามมีรหัสผ่านเด็ดขาด
   */
  async changePassword(
    user: { id: string; email: string },
    currentPassword: string,
    newPassword: string,
  ) {
    this.assertNotLockedOut(user.email);

    const result = await this.usersService.changePassword(
      user.id,
      currentPassword,
      newPassword,
    );

    if (!result.ok) {
      this.rateLimits.charge(this.lockoutKey(user.email), [this.lockout]);
      this.logger.warn(
        JSON.stringify({
          event: 'auth.password_change_rejected',
          sub: user.id,
          reason: result.reason,
        }),
      );
      // 400 ไม่ใช่ 401: session ยังใช้ได้ แค่รหัสที่กรอกผิด
      throw new BadRequestException('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }

    this.rateLimits.clear(this.lockoutKey(user.email), [this.lockout]);
    this.logger.log(
      JSON.stringify({
        event: 'auth.password_changed',
        sub: user.id,
        revokedSessions: result.revokedSessions,
      }),
    );

    return {
      message: 'เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่',
      revokedSessions: result.revokedSessions,
    };
  }

  /**
   * Sets a password without asking for the current one — the first password
   * of an account that has none, or a new one after the user forgot it.
   * Allowed only when:
   *   (a) the account has no password yet, or
   *   (b) the current session was opened through MJU SSO within
   *       MJU_REAUTH_WINDOW_MS (the user just proved who they are to MJU).
   * Anything else must go through change-password, which asks for the
   * current password. Other sessions end; this one stays signed in.
   */
  async setPassword(
    user: { id: string; email: string; sessionId: string },
    newPassword: string,
  ) {
    const currentHash = await this.usersService.findPasswordHash(user.id);
    if (currentHash === undefined) {
      throw new UnauthorizedException('User not found');
    }

    const mode = currentHash === null ? 'initial' : 'reset';
    if (mode === 'reset' && !(await this.isFreshMjuSession(user))) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.password_set_rejected',
          sub: user.id,
          reason: 'mju-reauth-required',
        }),
      );
      throw new ForbiddenException(
        'ตั้งรหัสผ่านใหม่โดยไม่ใช้รหัสเดิมได้ภายใน 10 นาทีหลังเข้าสู่ระบบด้วย MJU SSO เท่านั้น — ถ้าจำรหัสเดิมได้ ให้ใช้เปลี่ยนรหัสผ่าน',
      );
    }

    const revokedSessions = await this.usersService.setPassword(
      user.id,
      user.sessionId,
      newPassword,
      currentHash,
    );

    // Proved to MJU who they are: earlier wrong guesses no longer count.
    this.rateLimits.clear(this.lockoutKey(user.email), [this.lockout]);
    this.logger.log(
      JSON.stringify({
        event: 'auth.password_set',
        sub: user.id,
        mode,
        revokedSessions,
      }),
    );

    return { message: 'ตั้งรหัสผ่านแล้ว', revokedSessions };
  }

  /** Whether the account has a local password (never exposes the hash). */
  /**
   * What the account may do: role permissions plus per-account grants. The
   * web uses it to hide menus only — every request is still checked here.
   */
  permissionsOf(user: { id: string; role: string }) {
    return this.usersService.effectivePermissions(user);
  }

  async hasPassword(userId: string): Promise<boolean> {
    return !!(await this.usersService.findPasswordHash(userId));
  }

  /** The current session was opened through MJU SSO within the window. */
  private async isFreshMjuSession(user: {
    id: string;
    sessionId: string;
  }): Promise<boolean> {
    const session = await this.sessionService.getSession(user.sessionId);
    return (
      !!session &&
      session.userId === user.id &&
      session.status === 'ACTIVE' &&
      session.authMethod === AuthMethod.MJU_SSO &&
      Date.now() - session.createdAt.getTime() <= MJU_REAUTH_WINDOW_MS
    );
  }

  async logoutAll(userId: string) {
    const revokedCount =
      await this.sessionService.revokeAllUserSessions(userId);

    return {
      message: 'Logout from all sessions successful',
      revokedSessions: revokedCount,
    };
  }
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
