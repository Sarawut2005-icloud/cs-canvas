import { anyStandardsVersion } from './standards-versions.stub';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from 'src/database/prisma.service';
import { SubsystemActor, SubsystemsService } from './subsystems.service';
import { CreateSubsystemDto } from './dto/create-subsystem.dto';

const ADMIN: SubsystemActor = { id: 'user-001', role: 'admin' };

function baseDto(callbackUrl: string): CreateSubsystemDto {
  return {
    name: 'student-service',
    displayName: 'CSMJU Student Service',
    owner: 'admin',
    repo: 'demo-student-subsystem',
    standardsVersion: '1.0',
    defaultRoleMapping: { student: 'STUDENT' },
    requestedExceptions: [],
    callbackUrl,
  };
}

describe('SubsystemsService - callback URL registration rules', () => {
  let prisma: {
    subsystem: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  function serviceFor(
    environment: string,
    allowLocalhostCallbacks = false,
  ): SubsystemsService {
    const values: Record<string, unknown> = {
      'app.environment': environment,
      'app.allowLocalhostCallbacks': allowLocalhostCallbacks,
    };
    const config = {
      get: <T>(key: string, fallback?: T): T =>
        (key in values ? values[key] : fallback) as T,
    } as unknown as ConfigService;

    return new SubsystemsService(
      prisma as unknown as PrismaService,
      config,
      anyStandardsVersion(),
    );
  }

  beforeEach(() => {
    prisma = {
      subsystem: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'sub-1', ...data }),
          ),
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'sub-1', ...data }),
          ),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-001' }) },
    };
  });

  describe('development', () => {
    it('accepts a localhost callback over plain http', async () => {
      await expect(
        serviceFor('development').create(
          baseDto('http://localhost:3001/auth/callback'),
          ADMIN,
        ),
      ).resolves.toMatchObject({
        callbackUrl: 'http://localhost:3001/auth/callback',
      });
    });

    it('accepts 127.0.0.1 over plain http', async () => {
      await expect(
        serviceFor('development').create(
          baseDto('http://127.0.0.1:3002/auth/callback'),
          ADMIN,
        ),
      ).resolves.toBeDefined();
    });

    it('accepts https for a public host', async () => {
      await expect(
        serviceFor('development').create(
          baseDto('https://equipment.csmju2030.ac.th/auth/callback'),
          ADMIN,
        ),
      ).resolves.toBeDefined();
    });

    it('refuses plain http for a public host', async () => {
      await expect(
        serviceFor('development').create(
          baseDto('http://equipment.csmju2030.ac.th/auth/callback'),
          ADMIN,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.subsystem.create).not.toHaveBeenCalled();
    });

    it('refuses a non-http(s) scheme', async () => {
      await expect(
        serviceFor('development').create(baseDto('javascript:alert(1)'), ADMIN),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a value that is not an absolute URL', async () => {
      await expect(
        serviceFor('development').create(
          baseDto('localhost:3001/auth/callback'),
          ADMIN,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('baseUrl (Monitor)', () => {
    it('is optional — stored as null when omitted', async () => {
      await expect(
        serviceFor('development').create(
          baseDto('http://localhost:3001/auth/callback'),
          ADMIN,
        ),
      ).resolves.toMatchObject({ baseUrl: null });
    });

    it('accepts a localhost base URL over plain http in development', async () => {
      await expect(
        serviceFor('development').create(
          {
            ...baseDto('http://localhost:3001/auth/callback'),
            baseUrl: 'http://localhost:3001',
          },
          ADMIN,
        ),
      ).resolves.toMatchObject({ baseUrl: 'http://localhost:3001' });
    });

    it('refuses plain http for a public base URL, naming the field', async () => {
      await expect(
        serviceFor('development').create(
          {
            ...baseDto('https://equipment.csmju2030.ac.th/auth/callback'),
            baseUrl: 'http://equipment.csmju2030.ac.th',
          },
          ADMIN,
        ),
      ).rejects.toThrow(/^baseUrl must use HTTPS/);

      expect(prisma.subsystem.create).not.toHaveBeenCalled();
    });

    it('refuses a non-http(s) base URL scheme', async () => {
      await expect(
        serviceFor('development').create(
          {
            ...baseDto('http://localhost:3001/auth/callback'),
            baseUrl: 'ftp://localhost:3001',
          },
          ADMIN,
        ),
      ).rejects.toThrow('baseUrl must use http or https');
    });

    it('clears the base URL when an empty string is sent on update', async () => {
      prisma.subsystem.findUnique.mockResolvedValue({
        id: 'sub-1',
        ownerId: ADMIN.id,
        approvalStatus: 'PENDING',
        baseUrl: 'http://localhost:3001',
      });

      await serviceFor('development').update('sub-1', { baseUrl: '' }, ADMIN);

      const [[args]] = prisma.subsystem.update.mock.calls as [
        [{ data: { baseUrl?: string | null } }],
      ];
      expect(args.data.baseUrl).toBeNull();
    });
  });

  describe('production', () => {
    it('refuses plain http even for localhost', async () => {
      await expect(
        serviceFor('production').create(
          baseDto('http://localhost:3001/auth/callback'),
          ADMIN,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts https', async () => {
      await expect(
        serviceFor('production').create(
          baseDto('https://equipment.csmju2030.ac.th/auth/callback'),
          ADMIN,
        ),
      ).resolves.toBeDefined();
    });
  });

  // CORE_HUB_DEV_SERVER_HANDOFF 3ก.2: one rule for registration and SSO.
  describe('ALLOW_LOCALHOST_CALLBACKS', () => {
    const LOCAL_CALLBACK = 'http://localhost:3201/auth/callback';
    const LOCAL_BASE = 'http://localhost:3201';
    const OTHER_CALLBACK = 'http://example.com/auth/callback';
    const HTTPS_CALLBACK = 'https://equipment.csmju2030.ac.th/auth/callback';

    // [NODE_ENV, flag, http://localhost accepted]
    const rows: Array<[string, boolean, boolean]> = [
      ['development', false, true],
      ['development', true, true],
      ['production', false, false],
      ['production', true, true],
    ];

    describe.each(rows)(
      'NODE_ENV=%s, flag %p',
      (environment, flag, localhostAccepted) => {
        it(`${localhostAccepted ? 'accepts' : 'refuses'} an http://localhost callbackUrl`, async () => {
          const created = serviceFor(environment, flag).create(
            baseDto(LOCAL_CALLBACK),
            ADMIN,
          );

          if (localhostAccepted) {
            await expect(created).resolves.toMatchObject({
              callbackUrl: LOCAL_CALLBACK,
            });
          } else {
            await expect(created).rejects.toThrow(
              /^callbackUrl must use HTTPS/,
            );
          }
        });

        it(`${localhostAccepted ? 'accepts' : 'refuses'} an http://localhost baseUrl`, async () => {
          const created = serviceFor(environment, flag).create(
            { ...baseDto(HTTPS_CALLBACK), baseUrl: LOCAL_BASE },
            ADMIN,
          );

          if (localhostAccepted) {
            await expect(created).resolves.toMatchObject({
              baseUrl: LOCAL_BASE,
            });
          } else {
            await expect(created).rejects.toThrow(/^baseUrl must use HTTPS/);
          }
        });

        it('refuses plain http for any other host', async () => {
          await expect(
            serviceFor(environment, flag).create(
              baseDto(OTHER_CALLBACK),
              ADMIN,
            ),
          ).rejects.toThrow(/^callbackUrl must use HTTPS/);
          await expect(
            serviceFor(environment, flag).create(
              { ...baseDto(HTTPS_CALLBACK), baseUrl: 'http://example.com' },
              ADMIN,
            ),
          ).rejects.toThrow(/^baseUrl must use HTTPS/);
        });

        it('accepts https', async () => {
          await expect(
            serviceFor(environment, flag).create(
              {
                ...baseDto(HTTPS_CALLBACK),
                baseUrl: 'https://equipment.csmju2030.ac.th',
              },
              ADMIN,
            ),
          ).resolves.toBeDefined();
        });
      },
    );

    it('treats 127.0.0.1 and [::1] as localhost too', () => {
      const service = serviceFor('production', true);

      for (const url of [
        'http://127.0.0.1:3201/auth/callback',
        'http://[::1]:3201/auth/callback',
      ]) {
        expect(service.registrableUrlProblem('callbackUrl', url)).toBeNull();
      }
    });

    it('applies to an edited callbackUrl, not only to new registrations', async () => {
      prisma.subsystem.findUnique.mockResolvedValue({
        id: 'sub-1',
        name: 'student-service',
        ownerId: ADMIN.id,
        approvalStatus: 'PENDING',
      });

      await expect(
        serviceFor('production', false).update(
          'sub-1',
          { callbackUrl: LOCAL_CALLBACK },
          ADMIN,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        serviceFor('production', true).update(
          'sub-1',
          { callbackUrl: LOCAL_CALLBACK },
          ADMIN,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.subsystem.findUnique.mockResolvedValue({
        id: 'sub-1',
        name: 'student-service',
        ownerId: 'user-001',
        approvalStatus: 'PENDING',
      });
    });

    it('validates a new callback URL', async () => {
      await expect(
        serviceFor('production').update(
          'sub-1',
          { callbackUrl: 'http://evil.example.com/steal' },
          ADMIN,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('skips the check when the callback URL is not being changed', async () => {
      await expect(
        serviceFor('production').update(
          'sub-1',
          { displayName: 'Renamed' },
          ADMIN,
        ),
      ).resolves.toBeDefined();
    });
  });
});
