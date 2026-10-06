import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { RateLimitStore } from '../../common/rate-limit/rate-limit.store';
import { TooManyRequestsException } from '../../common/rate-limit/too-many-requests';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { SessionService } from './sessions/session.service';

/**
 * Wrong passwords per email (SSO_FIX_HANDOFF 5.9): the 11th attempt after 10
 * failures inside 15 minutes is answered 429 until the window has passed, and
 * a successful sign-in clears the count.
 */
describe('AuthService · login lockout', () => {
  const RIGHT = 'right-password';
  const hash = bcrypt.hashSync(RIGHT, 4);

  const users: Record<
    string,
    { id: string; email: string; passwordHash: string; role: { name: string } }
  > = {
    'student@core.local': {
      id: 'user-002',
      email: 'student@core.local',
      passwordHash: hash,
      role: { name: 'student' },
    },
    'staff@core.local': {
      id: 'user-003',
      email: 'staff@core.local',
      passwordHash: hash,
      role: { name: 'staff' },
    },
  };

  let store: RateLimitStore;
  let service: AuthService;

  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date('2026-09-27T00:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate'],
    });
    store = new RateLimitStore();

    const config = {
      get: (key: string) =>
        ({
          'rateLimit.loginLockout': { limit: 10, windowSec: 900 },
          'jwt.expiresIn': '15m',
          'jwt.refreshExpiresIn': '7d',
        })[key],
    } as unknown as ConfigService;

    const usersService = {
      linkedPersonStatus: jest.fn(() => Promise.resolve(null)),
      findByEmail: jest.fn((email: string) =>
        Promise.resolve(users[email] ?? null),
      ),
    } as unknown as UsersService;

    const jwtService = {
      sign: jest.fn(() => 'signed.jwt.token'),
    } as unknown as JwtService;

    const sessionService = {
      createSessionId: () => 'session-1',
      createSession: jest.fn(() => Promise.resolve()),
    } as unknown as SessionService;

    service = new AuthService(
      usersService,
      jwtService,
      config,
      sessionService,
      store,
    );
  });

  afterEach(() => {
    store.onModuleDestroy();
    jest.useRealTimers();
  });

  const fail = (email = 'student@core.local') =>
    expect(service.login(email, 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

  it('answers the 11th attempt with 429 after 10 wrong passwords, even with the right one', async () => {
    for (let i = 0; i < 10; i += 1) await fail();

    const attempt = service.login('student@core.local', RIGHT);
    await expect(attempt).rejects.toBeInstanceOf(TooManyRequestsException);
    await attempt.catch((error: TooManyRequestsException) => {
      expect(error.getStatus()).toBe(429);
      expect(error.retryAfterSec).toBe(900);
    });
  });

  it('lifts the lockout once the window has passed', async () => {
    for (let i = 0; i < 10; i += 1) await fail();
    jest.advanceTimersByTime(900_001);

    await expect(
      service.login('student@core.local', RIGHT),
    ).resolves.toMatchObject({
      access_token: 'signed.jwt.token',
    });
  });

  it('clears the count on a successful sign-in', async () => {
    for (let i = 0; i < 9; i += 1) await fail();
    await expect(
      service.login('student@core.local', RIGHT),
    ).resolves.toBeDefined();

    // Nine more wrong ones are allowed again: the earlier nine were forgotten.
    for (let i = 0; i < 9; i += 1) await fail();
    await fail();
    await expect(
      service.login('student@core.local', RIGHT),
    ).rejects.toBeInstanceOf(TooManyRequestsException);
  });

  it('does not lock another email', async () => {
    for (let i = 0; i < 10; i += 1) await fail();
    await expect(
      service.login('staff@core.local', RIGHT),
    ).resolves.toBeDefined();
  });

  it('treats an email the same whatever its case or spacing', async () => {
    for (let i = 0; i < 10; i += 1)
      await fail(i % 2 ? ' Student@Core.Local ' : 'student@core.local');
    await expect(
      service.login('STUDENT@core.local', RIGHT),
    ).rejects.toBeInstanceOf(TooManyRequestsException);
  });

  it('counts unknown emails too, so the lockout reveals nothing about which exist', async () => {
    for (let i = 0; i < 10; i += 1) await fail('nobody@core.local');
    await expect(
      service.login('nobody@core.local', 'wrong'),
    ).rejects.toBeInstanceOf(TooManyRequestsException);
  });
});
