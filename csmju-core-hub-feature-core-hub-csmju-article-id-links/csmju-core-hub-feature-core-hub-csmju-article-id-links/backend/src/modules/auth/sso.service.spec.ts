import { anyStandardsVersion } from '../subsystems/standards-versions.stub';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SsoAuthorizeDto } from './dto/sso-authorize.dto';

import { PrismaService } from 'src/database/prisma.service';
import { SubsystemsService } from '../subsystems/subsystems.service';
import { AuthenticatedCoreUser, SsoService } from './sso.service';

const USER: AuthenticatedCoreUser = {
  id: 'user-002',
  email: 'student@core.local',
  role: 'student',
  sessionId: 'session-123',
};

const REGISTERED_CALLBACK = 'http://localhost:3001/auth/callback';

function subsystemRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'subsystem-student-service',
    name: 'student-service',
    displayName: 'CSMJU Student Service',
    callbackUrl: REGISTERED_CALLBACK,
    approvalStatus: 'APPROVED',
    status: 'ACTIVE',
    defaultRoleMapping: {
      student: 'STUDENT',
      alumni: 'ALUMNI',
      staff: 'STAFF',
      admin: 'ADMIN',
    },
    ...overrides,
  };
}

describe('SsoService (central SSO + callback_url)', () => {
  let subsystems: {
    findByIdentifier: jest.Mock;
    registrableUrlProblem: jest.Mock;
  };
  let jwt: { sign: jest.Mock; decode: jest.Mock };
  let service: SsoService;

  const NOW = 1788577988;

  beforeEach(() => {
    subsystems = {
      findByIdentifier: jest.fn().mockResolvedValue(subsystemRecord()),
      // The transport rule itself is covered below and in
      // subsystems.service.spec.ts; here every callback passes it.
      registrableUrlProblem: jest.fn().mockReturnValue(null),
    };

    jwt = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
      decode: jest.fn().mockReturnValue({ iat: NOW, exp: NOW + 900 }),
    };

    const config = {
      get: <T>(key: string, fallback?: T): T =>
        (key === 'jwt.expiresIn' ? '15m' : fallback) as T,
    } as unknown as ConfigService;

    service = new SsoService(
      subsystems as unknown as SubsystemsService,
      jwt as unknown as JwtService,
      config,
    );
  });

  describe('successful handoff', () => {
    it('uses the callback URL from the Subsystem Registry', async () => {
      const handoff = await service.authorize(USER, {
        subsystem: 'student-service',
      });

      expect(subsystems.findByIdentifier).toHaveBeenCalledWith(
        'student-service',
      );
      expect(handoff.callbackUrl).toBe(REGISTERED_CALLBACK);

      const redirect = new URL(handoff.redirectUrl);
      expect(redirect.origin + redirect.pathname).toBe(REGISTERED_CALLBACK);
      expect(redirect.searchParams.get('access_token')).toBe(
        'signed.jwt.token',
      );
      expect(redirect.searchParams.get('token_type')).toBe('Bearer');
      expect(redirect.searchParams.get('expires_in')).toBe('900');
    });

    it('signs a handoff token: access contract + azp = registry name', async () => {
      await service.authorize(USER, { subsystem: 'student-service' });

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          sub: 'user-002',
          email: 'student@core.local',
          role: 'student',
          // The web session's sid: signing out of Core Hub ends it too.
          sid: 'session-123',
          iss: 'core-hub',
          aud: 'csmju2030',
          azp: 'student-service',
        },
        { expiresIn: '15m', keyid: 'core-hub-2026' },
      );
    });

    it('returns the subsystem identity and token metadata', async () => {
      const handoff = await service.authorize(USER, {
        subsystem: 'student-service',
      });

      expect(handoff.subsystem).toEqual({
        id: 'subsystem-student-service',
        name: 'student-service',
        displayName: 'CSMJU Student Service',
      });
      expect(handoff.tokenType).toBe('Bearer');
      expect(handoff.expiresIn).toBe(900);
    });

    it('echoes state back to the subsystem', async () => {
      const handoff = await service.authorize(USER, {
        subsystem: 'student-service',
        state: 'abc-123',
      });

      expect(handoff.state).toBe('abc-123');
      expect(new URL(handoff.redirectUrl).searchParams.get('state')).toBe(
        'abc-123',
      );
    });

    it('accepts a requested callback that matches the registered one', async () => {
      const handoff = await service.authorize(USER, {
        subsystem: 'student-service',
        callbackUrl: REGISTERED_CALLBACK,
      });

      expect(handoff.callbackUrl).toBe(REGISTERED_CALLBACK);
    });

    it('ignores a trailing slash when comparing callback URLs', async () => {
      await expect(
        service.authorize(USER, {
          subsystem: 'student-service',
          callbackUrl: `${REGISTERED_CALLBACK}/`,
        }),
      ).resolves.toBeDefined();
    });

    it('looks the subsystem up by id as well as by name', async () => {
      await service.authorize(USER, { subsystem: 'subsystem-student-service' });

      expect(subsystems.findByIdentifier).toHaveBeenCalledWith(
        'subsystem-student-service',
      );
    });
  });

  describe('callback_url validation (open-redirect protection)', () => {
    it('rejects an external callback URL', async () => {
      await expect(
        service.authorize(USER, {
          subsystem: 'student-service',
          callbackUrl: 'https://evil.example.com/steal',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('rejects a callback on the right host but a different path', async () => {
      await expect(
        service.authorize(USER, {
          subsystem: 'student-service',
          callbackUrl: 'http://localhost:3001/auth/callback-evil',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a callback on a different port', async () => {
      await expect(
        service.authorize(USER, {
          subsystem: 'student-service',
          callbackUrl: 'http://localhost:9999/auth/callback',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a callback carrying its own query string', async () => {
      await expect(
        service.authorize(USER, {
          subsystem: 'student-service',
          callbackUrl: `${REGISTERED_CALLBACK}?next=https://evil.example.com`,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a non-http(s) callback scheme', async () => {
      await expect(
        service.authorize(USER, {
          subsystem: 'student-service',
          callbackUrl: 'javascript:alert(1)',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a subsystem whose registered callback URL is unusable', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({ callbackUrl: 'not-a-url' }),
      );

      await expect(
        service.authorize(USER, { subsystem: 'student-service' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('subsystem access control (Core Hub decides WHO may enter)', () => {
    it('allows a core role listed in the registry role mapping', async () => {
      await expect(
        service.authorize(USER, { subsystem: 'student-service' }),
      ).resolves.toBeDefined();
    });

    it('refuses a core role the subsystem does not accept (403)', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({
          // csmju-equipment style mapping: no alumni
          defaultRoleMapping: {
            admin: 'ADMIN',
            staff: 'STAFF',
            student: 'USER',
          },
        }),
      );

      await expect(
        service.authorize(
          { ...USER, role: 'alumni' },
          { subsystem: 'student-service' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('issues no token and no redirect when access is refused', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({ defaultRoleMapping: { staff: 'STAFF' } }),
      );

      await expect(
        service.authorize(USER, { subsystem: 'student-service' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('compares core roles case-insensitively', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({ defaultRoleMapping: { STUDENT: 'STUDENT' } }),
      );

      await expect(
        service.authorize(
          { ...USER, role: 'Student' },
          { subsystem: 'student-service' },
        ),
      ).resolves.toBeDefined();
    });

    it('lets nobody in when the stored role mapping is empty', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({ defaultRoleMapping: {} }),
      );

      await expect(
        service.authorize(
          { ...USER, role: 'admin' },
          { subsystem: 'student-service' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });

  describe('individual exceptions (effective role)', () => {
    const X = { ...USER, username: '6504101001' };
    const exception = (overrides: Record<string, unknown> = {}) => ({
      username: '6504101001',
      role: 'staff',
      status: 'APPROVED',
      updatedAt: new Date('2026-10-01T00:00:00Z'),
      ...overrides,
    });
    const signedRole = () =>
      (jwt.sign.mock.calls[0] as [{ role: string }])[0].role;

    it('lets an approved exception in with its role in the token', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({
          defaultRoleMapping: { staff: 'STAFF' },
          exceptions: [exception()],
        }),
      );

      await service.authorize(X, { subsystem: 'student-service' });

      expect(signedRole()).toBe('staff');
    });

    it('keeps the account role where the user has no exception', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({ exceptions: [exception({ username: 'someone' })] }),
      );

      await service.authorize(X, { subsystem: 'student-service' });

      expect(signedRole()).toBe('student');
    });

    it.each(['REQUESTED', 'REJECTED'])(
      'ignores a %s exception',
      async (status) => {
        subsystems.findByIdentifier.mockResolvedValue(
          subsystemRecord({
            defaultRoleMapping: { staff: 'STAFF' },
            exceptions: [exception({ status })],
          }),
        );

        await expect(
          service.authorize(X, { subsystem: 'student-service' }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );

    it('refuses when the exception role has left the mapping', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({
          defaultRoleMapping: { student: 'STUDENT' },
          exceptions: [exception({ role: 'staff' })],
        }),
      );

      await expect(
        service.authorize(X, { subsystem: 'student-service' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('uses the newest approved exception when there are several', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({
          exceptions: [
            exception({ role: 'alumni', updatedAt: new Date('2026-09-01') }),
            exception({ role: 'staff', updatedAt: new Date('2026-09-20') }),
          ],
        }),
      );

      await service.authorize(X, { subsystem: 'student-service' });

      expect(signedRole()).toBe('staff');
    });

    it('applies no exception to an account without a username', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({ exceptions: [exception({ username: '' })] }),
      );

      await service.authorize(
        { ...USER, username: null },
        { subsystem: 'student-service' },
      );

      expect(signedRole()).toBe('student');
    });
  });

  describe('registry eligibility', () => {
    it('propagates 404 for an unknown subsystem', async () => {
      subsystems.findByIdentifier.mockRejectedValue(
        new NotFoundException('Subsystem not found'),
      );

      await expect(
        service.authorize(USER, { subsystem: 'does-not-exist' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a subsystem that is not approved', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({ approvalStatus: 'PENDING' }),
      );

      await expect(
        service.authorize(USER, { subsystem: 'student-service' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a subsystem that is not active', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({ status: 'SUSPENDED' }),
      );

      await expect(
        service.authorize(USER, { subsystem: 'student-service' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not issue a token when the subsystem is ineligible', async () => {
      subsystems.findByIdentifier.mockResolvedValue(
        subsystemRecord({ status: 'INACTIVE' }),
      );

      await expect(
        service.authorize(USER, { subsystem: 'student-service' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });
});

// CORE_HUB_DEV_SERVER_HANDOFF 3ก.2: switching ALLOW_LOCALHOST_CALLBACKS off
// closes SSO to every stored http://localhost callback at once.
describe('SsoService with the registration transport rule', () => {
  const LOCAL_CALLBACK = 'http://localhost:3201/auth/callback';
  const HTTPS_CALLBACK = 'https://equipment.csmju2030.ac.th/auth/callback';

  let jwt: { sign: jest.Mock; decode: jest.Mock };

  function ssoFor(
    environment: string,
    allowLocalhostCallbacks: boolean,
    callbackUrl: string,
  ): SsoService {
    const values: Record<string, unknown> = {
      'app.environment': environment,
      'app.allowLocalhostCallbacks': allowLocalhostCallbacks,
      'jwt.expiresIn': '15m',
    };
    const config = {
      get: <T>(key: string, fallback?: T): T =>
        (key in values ? values[key] : fallback) as T,
    } as unknown as ConfigService;

    // The real rule, with the registry lookup stubbed.
    const subsystems = new SubsystemsService(
      {} as unknown as PrismaService,
      config,
      anyStandardsVersion(),
    );
    jest
      .spyOn(subsystems, 'findByIdentifier')
      .mockResolvedValue(
        subsystemRecord({ callbackUrl }) as unknown as Awaited<
          ReturnType<SubsystemsService['findByIdentifier']>
        >,
      );

    return new SsoService(subsystems, jwt as unknown as JwtService, config);
  }

  beforeEach(() => {
    jwt = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
      decode: jest.fn().mockReturnValue({ iat: 0, exp: 900 }),
    };
  });

  it('refuses an http://localhost callback in production with the flag off — 409, no token', async () => {
    await expect(
      ssoFor('production', false, LOCAL_CALLBACK).authorize(USER, {
        subsystem: 'student-service',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('never puts the callback URL in the refusal', async () => {
    const refusal: unknown = await ssoFor('production', false, LOCAL_CALLBACK)
      .authorize(USER, { subsystem: 'student-service' })
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ConflictException);
    expect((refusal as Error).message).not.toContain('localhost:3201');
  });

  it('hands off to an http://localhost callback in production with the flag on', async () => {
    const handoff = await ssoFor('production', true, LOCAL_CALLBACK).authorize(
      USER,
      { subsystem: 'student-service' },
    );

    expect(handoff.callbackUrl).toBe(LOCAL_CALLBACK);
    expect(jwt.sign).toHaveBeenCalledTimes(1);
  });

  it('leaves https callbacks alone either way', async () => {
    for (const flag of [false, true]) {
      const handoff = await ssoFor(
        'production',
        flag,
        HTTPS_CALLBACK,
      ).authorize(USER, { subsystem: 'student-service' });
      expect(handoff.callbackUrl).toBe(HTTPS_CALLBACK);
    }
  });

  it('keeps http://localhost working outside production without the flag', async () => {
    await expect(
      ssoFor('development', false, LOCAL_CALLBACK).authorize(USER, {
        subsystem: 'student-service',
      }),
    ).resolves.toMatchObject({ callbackUrl: LOCAL_CALLBACK });
  });
});

describe('SsoAuthorizeDto', () => {
  it('accepts a localhost callback URL (development subsystems have no TLD)', async () => {
    const dto = plainToInstance(SsoAuthorizeDto, {
      subsystem: 'student-service',
      callback_url: 'http://localhost:3001/auth/callback',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('still rejects a callback URL without a protocol', async () => {
    const dto = plainToInstance(SsoAuthorizeDto, {
      subsystem: 'student-service',
      callback_url: 'localhost:3001/auth/callback',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
