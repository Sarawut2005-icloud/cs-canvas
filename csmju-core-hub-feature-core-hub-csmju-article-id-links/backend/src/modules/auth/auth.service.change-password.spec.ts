import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { RateLimitStore } from '../../common/rate-limit/rate-limit.store';
import { TooManyRequestsException } from '../../common/rate-limit/too-many-requests';
import type {
  ChangePasswordResult,
  UsersService,
} from '../users/users.service';
import { AuthService } from './auth.service';
import { SessionService } from './sessions/session.service';

/**
 * POST /auth/change-password — รหัสปัจจุบันที่ผิดนับรวมกับ lockout ของ login
 * (ต่ออีเมล) ถูกล็อกแล้วก็ถูกทั้งสองทาง และสำเร็จแล้วล้างตัวนับ
 */
describe('AuthService · changePassword', () => {
  const USER = { id: 'user-002', email: 'student@core.local' };
  const hash = bcrypt.hashSync('right-password', 4);

  let store: RateLimitStore;
  let service: AuthService;
  let changePassword: jest.Mock<
    Promise<ChangePasswordResult>,
    [string, string, string]
  >;

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

    changePassword = jest.fn<
      Promise<ChangePasswordResult>,
      [string, string, string]
    >((_id, current) =>
      Promise.resolve<ChangePasswordResult>(
        current === 'right-password'
          ? { ok: true, revokedSessions: 2 }
          : { ok: false, reason: 'wrong-current-password' },
      ),
    );

    const usersService = {
      changePassword,
      linkedPersonStatus: jest.fn(() => Promise.resolve(null)),
      findByEmail: jest.fn(() =>
        Promise.resolve({
          ...USER,
          passwordHash: hash,
          role: { name: 'student' },
        }),
      ),
    } as unknown as UsersService;

    service = new AuthService(
      usersService,
      { sign: jest.fn(() => 'signed.jwt.token') } as unknown as JwtService,
      config,
      {
        createSessionId: () => 'session-1',
        createSession: jest.fn(() => Promise.resolve()),
      } as unknown as SessionService,
      store,
    );
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.useRealTimers());

  it('สำเร็จ → คืนข้อความและจำนวน session ที่ยกเลิก ไม่มีรหัสผ่านในผลลัพธ์', async () => {
    const result = await service.changePassword(
      USER,
      'right-password',
      'NewPass123',
    );
    expect(result).toEqual({
      message: 'เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่',
      revokedSessions: 2,
    });
    expect(changePassword).toHaveBeenCalledWith(
      'user-002',
      'right-password',
      'NewPass123',
    );
  });

  it('รหัสปัจจุบันผิด → 400 (ไม่ใช่ 401 — session ยังใช้ได้)', async () => {
    const call = service.changePassword(USER, 'wrong', 'NewPass123');
    await expect(call).rejects.toBeInstanceOf(BadRequestException);
    await expect(call).rejects.toThrow('รหัสผ่านปัจจุบันไม่ถูกต้อง');
  });

  it('ผิดครบ 10 ครั้ง → ครั้งที่ 11 ตอบ 429 แม้รหัสถูก และไม่เรียก UsersService', async () => {
    for (let i = 0; i < 10; i++) {
      await expect(
        service.changePassword(USER, 'wrong', 'NewPass123'),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    changePassword.mockClear();

    await expect(
      service.changePassword(USER, 'right-password', 'NewPass123'),
    ).rejects.toBeInstanceOf(TooManyRequestsException);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('ใช้ตัวนับเดียวกับ login: ผิดที่ change-password แล้ว login ก็ถูกล็อก', async () => {
    for (let i = 0; i < 10; i++) {
      await service
        .changePassword(USER, 'wrong', 'NewPass123')
        .catch(() => undefined);
    }
    await expect(
      service.login(USER.email, 'right-password'),
    ).rejects.toBeInstanceOf(TooManyRequestsException);
  });

  it('ใช้ตัวนับเดียวกับ login: login ผิด 10 ครั้งแล้ว change-password ก็ถูกล็อก', async () => {
    for (let i = 0; i < 10; i++) {
      await expect(service.login(USER.email, 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    await expect(
      service.changePassword(USER, 'right-password', 'NewPass123'),
    ).rejects.toBeInstanceOf(TooManyRequestsException);
  });

  it('พ้นหน้าต่าง 15 นาทีแล้วลองใหม่ได้ และสำเร็จแล้วล้างตัวนับ', async () => {
    for (let i = 0; i < 10; i++) {
      await service
        .changePassword(USER, 'wrong', 'NewPass123')
        .catch(() => undefined);
    }
    jest.advanceTimersByTime(15 * 60 * 1000 + 1000);

    await expect(
      service.changePassword(USER, 'right-password', 'NewPass123'),
    ).resolves.toMatchObject({ revokedSessions: 2 });

    // ตัวนับถูกล้าง: ผิดอีก 9 ครั้งยังไม่ถูกล็อก
    for (let i = 0; i < 9; i++) {
      await service
        .changePassword(USER, 'wrong', 'NewPass123')
        .catch(() => undefined);
    }
    await expect(
      service.changePassword(USER, 'right-password', 'NewPass123'),
    ).resolves.toMatchObject({ revokedSessions: 2 });
  });

  it('ข้อผิดพลาดจากกติกา (400 ของ UsersService) ส่งต่อตรง ๆ และไม่นับเข้า lockout', async () => {
    changePassword.mockRejectedValue(
      new BadRequestException({
        message: ['รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'],
      }),
    );
    for (let i = 0; i < 12; i++) {
      await expect(
        service.changePassword(USER, 'right-password', 'short'),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    // ไม่ถูกล็อก — ยังเข้าสู่ระบบได้
    await expect(
      service.login(USER.email, 'right-password'),
    ).resolves.toBeDefined();
  });
});
