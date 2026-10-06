import { anyStandardsVersion } from './standards-versions.stub';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PrismaService } from 'src/database/prisma.service';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { CreateSubsystemDto } from './dto/create-subsystem.dto';
import { UpdateRoleMappingDto } from './dto/update-role-mapping.dto';
import { UpdateSubsystemDto } from './dto/update-subsystem.dto';
import { SubsystemActor, SubsystemsService } from './subsystems.service';

// @nestjs/mapped-types v12 ships ESM only, which CommonJS jest cannot load
// (subsystems.permissions.spec.ts). This stand-in does what PartialType does
// for validation: inherit every rule and make each property optional.
jest.mock('@nestjs/mapped-types', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cv = require('class-validator') as typeof import('class-validator');
  return {
    PartialType: (base: new () => object) => {
      class Partial extends base {}
      const properties = new Set(
        cv
          .getMetadataStorage()
          .getTargetValidationMetadatas(base, '', true, false)
          .map((meta) => meta.propertyName),
      );
      for (const property of properties) {
        cv.IsOptional()(Partial.prototype, property);
      }
      return Partial;
    },
  };
});

const VALID = {
  name: 'equipment-service',
  displayName: 'ระบบครุภัณฑ์',
  repo: 'csmju-equipment',
  standardsVersion: '1.0',
  defaultRoleMapping: { staff: 'STAFF', admin: 'ADMIN' },
  callbackUrl: 'http://localhost:3002/auth/callback',
};

async function failing(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, body));
  return errors.map((error) => error.property);
}

/**
 * Registry input that SSO depends on (CORE_HUB_TOKEN_SCOPE 3ง.2 · 3ง.3 · 3ค.3).
 * Every failure here is a 400 VALIDATION_ERROR: the DTO ones through the
 * ValidationPipe, the service ones as a BadRequestException with a message
 * array, which HttpExceptionFilter reports the same way.
 */
describe('subsystem registry validation', () => {
  describe('subsystem name — same rule as /sso/authorize', () => {
    it.each(['a', 'equipment-service', 'a1-b2-c3', 'x'.repeat(64)])(
      'accepts %s',
      async (name) => {
        expect(await failing(CreateSubsystemDto, { ...VALID, name })).toEqual(
          [],
        );
      },
    );

    it.each(['a--b', 'x-', '-x', 'A-b', 'a_b', '', 'x'.repeat(65)])(
      'refuses %j',
      async (name) => {
        expect(await failing(CreateSubsystemDto, { ...VALID, name })).toContain(
          'name',
        );
      },
    );

    it('applies on edit too', async () => {
      expect(await failing(UpdateSubsystemDto, { name: 'a--b' })).toContain(
        'name',
      );
    });
  });

  describe('role mapping', () => {
    const cases: [string, unknown][] = [
      ['an empty mapping', {}],
      ['a key in the wrong case', { Staff: 'STAFF' }],
      ['a key that is not a core role', { 'finance-officer': 'X' }],
      ['an empty subsystem role', { staff: '  ' }],
      ['a non-string subsystem role', { staff: 1 }],
      ['an array', ['staff']],
      ['null', null],
    ];

    it.each(cases)('refuses %s on create', async (_label, mapping) => {
      expect(
        await failing(CreateSubsystemDto, {
          ...VALID,
          defaultRoleMapping: mapping,
        }),
      ).toContain('defaultRoleMapping');
    });

    // null on PATCH is refused by the service (PartialType's IsOptional
    // skips it) — see "refuses a null mapping on PATCH" below.
    it.each(cases.filter(([, mapping]) => mapping !== null))(
      'refuses %s on PATCH',
      async (_label, mapping) => {
        expect(
          await failing(UpdateSubsystemDto, { defaultRoleMapping: mapping }),
        ).toContain('defaultRoleMapping');
      },
    );

    it.each(cases)(
      'refuses %s on PATCH /role-mapping',
      async (_label, mapping) => {
        expect(
          await failing(UpdateRoleMappingDto, { defaultRoleMapping: mapping }),
        ).toContain('defaultRoleMapping');
      },
    );

    it('accepts all six core roles', async () => {
      const mapping = Object.fromEntries(
        ['student', 'alumni', 'staff', 'lecturer', 'guest', 'admin'].map(
          (role) => [role, role.toUpperCase()],
        ),
      );
      expect(
        await failing(UpdateRoleMappingDto, { defaultRoleMapping: mapping }),
      ).toEqual([]);
    });

    it('leaves the mapping out of a PATCH that does not send it', async () => {
      expect(
        await failing(UpdateSubsystemDto, { displayName: 'ใหม่' }),
      ).toEqual([]);
    });
  });

  describe('exception role in the DTO', () => {
    it('must be one of the six core roles', async () => {
      expect(
        await failing(CreateExceptionDto, {
          username: 'x',
          role: 'lab-assistant',
          reason: 'r',
        }),
      ).toContain('role');
    });

    it('is checked inside requestedExceptions too', async () => {
      const errors = await validate(
        plainToInstance(CreateSubsystemDto, {
          ...VALID,
          requestedExceptions: [{ username: 'x', role: 'Staff', reason: 'r' }],
        }),
      );
      expect(errors.map((e) => e.property)).toContain('requestedExceptions');
    });
  });

  describe('exception role and username against the registry', () => {
    const STAFF: SubsystemActor = { id: 'user-003', role: 'staff' };
    let prisma: {
      subsystem: { findUnique: jest.Mock; create: jest.Mock };
      user: { findUnique: jest.Mock; findMany: jest.Mock };
      subsystemException: { create: jest.Mock };
      subsystemEvent: { create: jest.Mock };
      $transaction: jest.Mock;
    };
    let service: SubsystemsService;

    beforeEach(() => {
      prisma = {
        subsystem: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sub-1',
            ownerId: STAFF.id,
            defaultRoleMapping: { staff: 'STAFF', admin: 'ADMIN' },
            approvalStatus: 'APPROVED',
          }),
          create: jest.fn().mockResolvedValue({ id: 'sub-1' }),
        },
        user: {
          findUnique: jest.fn(),
          findMany: jest.fn(
            ({ where }: { where: { username: { in: string[] } } }) =>
              Promise.resolve(
                where.username.in
                  .filter((u) => u === '6504101001')
                  .map((username) => ({ username })),
              ),
          ),
        },
        subsystemException: { create: jest.fn().mockResolvedValue({}) },
        subsystemEvent: { create: jest.fn().mockResolvedValue({}) },
        $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      };
      service = new SubsystemsService(
        prisma as unknown as PrismaService,
        { get: () => 'development' } as unknown as ConfigService,
        anyStandardsVersion(),
      );
    });

    async function rejection(promise: Promise<unknown>) {
      const error = await promise.then(
        () => null,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        message: string[];
        statusCode: number;
      };
      // An array → HttpExceptionFilter answers VALIDATION_ERROR.
      expect(Array.isArray(response.message)).toBe(true);
      expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
      return response.message;
    }

    it('refuses a role that is not in the mapping', async () => {
      const messages = await rejection(
        service.createException(
          'sub-1',
          { username: '6504101001', role: 'student', reason: 'lab' },
          STAFF,
        ),
      );
      expect(messages.join()).toMatch(/student/);
      expect(prisma.subsystemException.create).not.toHaveBeenCalled();
    });

    it('refuses a username that does not exist', async () => {
      const messages = await rejection(
        service.createException(
          'sub-1',
          { username: 'nobody', role: 'staff', reason: 'lab' },
          STAFF,
        ),
      );
      expect(messages.join()).toMatch(/nobody/);
      expect(prisma.subsystemException.create).not.toHaveBeenCalled();
    });

    it('refuses a null mapping on PATCH', async () => {
      await rejection(
        service.update(
          'sub-1',
          { defaultRoleMapping: null as unknown as Record<string, string> },
          STAFF,
        ),
      );
    });

    it('records a valid request', async () => {
      await service.createException(
        'sub-1',
        { username: '6504101001', role: 'staff', reason: 'lab' },
        STAFF,
      );
      expect(prisma.subsystemException.create).toHaveBeenCalled();
    });

    it('checks requestedExceptions against the mapping being registered', async () => {
      prisma.subsystem.findUnique.mockResolvedValue(null);

      await rejection(
        service.create(
          {
            ...VALID,
            requestedExceptions: [
              { username: '6504101001', role: 'student', reason: 'r' },
            ],
          },
          STAFF,
        ),
      );
      await rejection(
        service.create(
          {
            ...VALID,
            requestedExceptions: [
              { username: 'nobody', role: 'staff', reason: 'r' },
            ],
          },
          STAFF,
        ),
      );
      expect(prisma.subsystem.create).not.toHaveBeenCalled();

      await service.create(
        {
          ...VALID,
          requestedExceptions: [
            { username: '6504101001', role: 'staff', reason: 'r' },
          ],
        },
        STAFF,
      );
      expect(prisma.subsystem.create).toHaveBeenCalled();
    });
  });
});
