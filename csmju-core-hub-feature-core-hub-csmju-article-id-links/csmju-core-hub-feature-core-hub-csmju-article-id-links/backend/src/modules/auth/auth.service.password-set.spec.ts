import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

import { RateLimitStore } from '../../common/rate-limit/rate-limit.store';
import type { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { SessionService } from './sessions/session.service';

const NOW = new Date('2026-09-28T10:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

// ข้อมูลสมมติ (mock) เท่านั้น
const USER = {
  id: 'user-9900000001',
  email: 'mju9900000001@mju.ac.th',
  sessionId: 'session-now',
};

type SessionRow = {
  id: string;
  userId: string;
  status: 'ACTIVE' | 'REVOKED';
  authMethod: 'PASSWORD' | 'MJU_SSO';
  createdAt: Date;
  expiresAt: Date;
  refreshTokenHash: string;
};

function makeService(opts: {
  passwordHash?: string | null;
  session?: Partial<SessionRow>;
  personStatus?: 'ACTIVE' | 'GRADUATED' | 'INACTIVE' | null;
}) {
  const store = new RateLimitStore();
  const session: SessionRow = {
    id: USER.sessionId,
    userId: USER.id,
    status: 'ACTIVE',
    authMethod: 'MJU_SSO',
    createdAt: minutesAgo(1),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    // hash ของ refresh token 'rt' ที่ test ส่งมา
    refreshTokenHash: createHash('sha256').update('rt').digest('hex'),
    ...opts.session,
  };

  const usersService = {
    findPasswordHash: jest.fn(() =>
      Promise.resolve(
        opts.passwordHash === undefined ? null : opts.passwordHash,
      ),
    ),
    setPassword: jest.fn(() => Promise.resolve(2)),
    linkedPersonStatus: jest.fn(() =>
      Promise.resolve(opts.personStatus ?? null),
    ),
    findByEmail: jest.fn(() =>
      Promise.resolve({
        id: USER.id,
        email: USER.email,
        passwordHash: bcrypt.hashSync('RightPass2026', 4),
        role: { name: 'student' },
      }),
    ),
    findById: jest.fn(() =>
      Promise.resolve({
        id: USER.id,
        email: USER.email,
        role: { name: 'student' },
      }),
    ),
  };
  const sessionService = {
    createSessionId: () => 'session-new',
    createSession: jest.fn(() => Promise.resolve()),
    getSession: jest.fn(() => Promise.resolve(session)),
    revokeSession: jest.fn(() => Promise.resolve(true)),
    updateRefreshTokenHash: jest.fn(() => Promise.resolve(true)),
  };
  const config = {
    get: (key: string) =>
      ({
        'rateLimit.loginLockout': { limit: 10, windowSec: 900 },
        'jwt.expiresIn': '15m',
        'jwt.refreshExpiresIn': '7d',
      })[key],
  } as unknown as ConfigService;
  const jwtService = {
    sign: jest.fn(() => 'signed.jwt.token'),
    verify: jest.fn(() => ({ sub: USER.id, sid: USER.sessionId })),
  };

  const service = new AuthService(
    usersService as unknown as UsersService,
    jwtService as unknown as JwtService,
    config,
    sessionService as unknown as SessionService,
    store,
  );
  return { service, usersService, sessionService };
}

describe('AuthService · setPassword (POST /auth/password/set)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.useRealTimers());

  it('บัญชียังไม่มีรหัสผ่าน → ตั้งได้ แม้ session MJU เก่ากว่า 10 นาที', async () => {
    const { service, usersService } = makeService({
      passwordHash: null,
      session: { createdAt: minutesAgo(60) },
    });
    await expect(service.setPassword(USER, 'MyNewPass2026')).resolves.toEqual({
      message: 'ตั้งรหัสผ่านแล้ว',
      revokedSessions: 2,
    });
    expect(usersService.setPassword).toHaveBeenCalledWith(
      USER.id,
      USER.sessionId,
      'MyNewPass2026',
      null,
    );
  });

  it('มีรหัสแล้ว + session MJU อายุ 9 นาที → ตั้งใหม่ได้โดยไม่ถามรหัสเดิม', async () => {
    const { service, usersService } = makeService({
      passwordHash: '$2b$12$old',
      session: { createdAt: minutesAgo(9) },
    });
    await expect(
      service.setPassword(USER, 'MyNewPass2026'),
    ).resolves.toMatchObject({ revokedSessions: 2 });
    expect(usersService.setPassword).toHaveBeenCalledWith(
      USER.id,
      USER.sessionId,
      'MyNewPass2026',
      '$2b$12$old',
    );
  });

  it('มีรหัสแล้ว + session MJU อายุ 11 นาที → 403', async () => {
    const { service, usersService } = makeService({
      passwordHash: '$2b$12$old',
      session: { createdAt: minutesAgo(11) },
    });
    await expect(
      service.setPassword(USER, 'MyNewPass2026'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersService.setPassword).not.toHaveBeenCalled();
  });

  it('มีรหัสแล้ว + session ที่ login ด้วยรหัสผ่าน → 403 (ต้องใช้ change-password)', async () => {
    const { service, usersService } = makeService({
      passwordHash: '$2b$12$old',
      session: { authMethod: 'PASSWORD', createdAt: minutesAgo(1) },
    });
    await expect(
      service.setPassword(USER, 'MyNewPass2026'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersService.setPassword).not.toHaveBeenCalled();
  });

  it('session ไม่ใช่ของผู้ใช้นี้ หรือถูกยกเลิกแล้ว → 403', async () => {
    for (const session of [
      { userId: 'someone-else' },
      { status: 'REVOKED' as const },
    ]) {
      const { service } = makeService({ passwordHash: '$2b$12$old', session });
      await expect(
        service.setPassword(USER, 'MyNewPass2026'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('รหัสไม่ผ่านกติกา → 400 จาก UsersService ส่งต่อตรง ๆ', async () => {
    const { service, usersService } = makeService({ passwordHash: null });
    usersService.setPassword.mockRejectedValue(
      new BadRequestException({
        message: ['รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'],
      }),
    );
    await expect(service.setPassword(USER, 'short')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('ไม่พบบัญชี → 401', async () => {
    const { service, usersService } = makeService({});
    usersService.findPasswordHash.mockResolvedValue(
      undefined as unknown as null,
    );
    await expect(
      service.setPassword(USER, 'MyNewPass2026'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('log ไม่มีรหัสผ่าน', async () => {
    const log = jest.spyOn(console, 'log');
    const { service } = makeService({ passwordHash: null });
    await service.setPassword(USER, 'MyNewPass2026');
    expect(JSON.stringify(log.mock.calls)).not.toContain('MyNewPass2026');
  });
});

describe('AuthService · issueSession บันทึกวิธี login', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.useRealTimers());

  it('login ด้วยรหัสผ่าน → PASSWORD', async () => {
    const { service, sessionService } = makeService({});
    await service.login(USER.email, 'RightPass2026');
    expect(sessionService.createSession).toHaveBeenCalledWith(
      'session-new',
      USER.id,
      expect.any(Date),
      expect.any(String),
      'PASSWORD',
    );
  });

  it('MJU SSO → MJU_SSO', async () => {
    const { service, sessionService } = makeService({});
    await service.issueSession(
      { id: USER.id, email: USER.email, role: { name: 'student' } },
      'MJU_SSO',
    );
    expect(sessionService.createSession).toHaveBeenCalledWith(
      'session-new',
      USER.id,
      expect.any(Date),
      expect.any(String),
      'MJU_SSO',
    );
  });
});

describe('AuthService · คนที่พ้นสภาพ (INACTIVE)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.useRealTimers());

  it('login ด้วยรหัสที่ถูก → 403 และไม่เปิด session', async () => {
    const { service, sessionService } = makeService({
      personStatus: 'INACTIVE',
    });
    await expect(
      service.login(USER.email, 'RightPass2026'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('login ด้วยรหัสผิด → 401 เหมือนเดิม (ไม่บอกสถานะในทะเบียน)', async () => {
    const { service } = makeService({ personStatus: 'INACTIVE' });
    await expect(
      service.login(USER.email, 'WrongPass2026'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh → 403 และยกเลิก session นั้น', async () => {
    const { service, sessionService } = makeService({
      personStatus: 'INACTIVE',
    });
    await expect(
      service.refresh({ refresh_token: 'rt' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessionService.revokeSession).toHaveBeenCalledWith(
      USER.sessionId,
      USER.id,
    );
    expect(sessionService.updateRefreshTokenHash).not.toHaveBeenCalled();
  });

  it('บัญชีไม่ผูกบุคคล (seed) หรือ GRADUATED → login ได้ตามปกติ', async () => {
    for (const personStatus of [null, 'GRADUATED' as const]) {
      const { service } = makeService({ personStatus });
      await expect(service.login(USER.email, 'RightPass2026')).resolves.toEqual(
        {
          access_token: 'signed.jwt.token',
          refresh_token: 'signed.jwt.token',
        },
      );
    }
  });
});
