import { anyStandardsVersion } from './standards-versions.stub';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from 'src/database/prisma.service';
import { Paginated } from 'src/common/pagination/paginated';
import { SubsystemActor, SubsystemsService } from './subsystems.service';
import { CreateSubsystemDto } from './dto/create-subsystem.dto';

/** The argument a mocked Prisma call received (`findMany({ where })`, …). */
interface PrismaArgs {
  data: Record<string, unknown> & { events?: { create: unknown } };
  where?: Record<string, unknown>;
  skip?: number;
  take?: number;
}

function argsOf(mock: jest.Mock, call = 0): PrismaArgs {
  return (mock.mock.calls as PrismaArgs[][])[call][0];
}

const ADMIN: SubsystemActor = { id: 'user-001', role: 'admin' };
const STAFF: SubsystemActor = { id: 'user-003', role: 'staff' };

const REGISTRATION: CreateSubsystemDto = {
  name: 'equipment-service',
  displayName: 'ระบบครุภัณฑ์',
  repo: 'csmju-equipment',
  standardsVersion: '1.0',
  defaultRoleMapping: { staff: 'STAFF', admin: 'ADMIN' },
  callbackUrl: 'http://localhost:3002/auth/callback',
};

function stored(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    name: 'equipment-service',
    displayName: 'ระบบครุภัณฑ์',
    ownerId: STAFF.id,
    repo: 'csmju-equipment',
    standardsVersion: '1.0',
    defaultRoleMapping: { staff: 'STAFF', admin: 'ADMIN' },
    callbackUrl: 'http://localhost:3002/auth/callback',
    approvalStatus: 'PENDING',
    status: 'INACTIVE',
    ...overrides,
  };
}

describe('SubsystemsService - management rules', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: SubsystemsService;

  function mockPrisma() {
    const echo = jest
      .fn()
      .mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ ...stored(), ...data }),
      );

    return {
      subsystem: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: echo,
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: object }) =>
            Promise.resolve({ ...stored(), ...data }),
          ),
        delete: jest.fn().mockResolvedValue(stored()),
      },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
  }

  beforeEach(() => {
    prisma = mockPrisma();
    const config = {
      get: () => 'development',
    } as unknown as ConfigService;
    service = new SubsystemsService(
      prisma as unknown as PrismaService,
      config,
      anyStandardsVersion(),
    );
  });

  describe('registration', () => {
    beforeEach(() => prisma.subsystem.findUnique.mockResolvedValue(null));

    it('makes the caller the owner when no owner is given', async () => {
      await service.create(REGISTRATION, STAFF);

      const { data } = argsOf(prisma.subsystem.create);
      expect(data.ownerId).toBe(STAFF.id);
      expect(data.events?.create).toMatchObject({
        actorId: STAFF.id,
        action: 'SUBMITTED',
      });
    });

    it('refuses staff registering a subsystem under someone else (403)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: ADMIN.id });

      await expect(
        service.create({ ...REGISTRATION, owner: 'admin' }, STAFF),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.subsystem.create).not.toHaveBeenCalled();
    });

    it('lets an admin register on behalf of an owner', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: STAFF.id });

      await service.create({ ...REGISTRATION, owner: 'staff' }, ADMIN);

      expect(argsOf(prisma.subsystem.create).data.ownerId).toBe(STAFF.id);
    });

    it('refuses a duplicate name (409)', async () => {
      prisma.subsystem.findUnique.mockResolvedValue(stored());

      await expect(service.create(REGISTRATION, STAFF)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('ownership', () => {
    it("answers 403 — not 404 — for another staff member's subsystem", async () => {
      prisma.subsystem.findUnique.mockResolvedValue(
        stored({ ownerId: 'user-999' }),
      );

      await expect(service.findOne('sub-1', STAFF)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.update('sub-1', { displayName: 'x' }, STAFF),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('still answers 404 for a subsystem that does not exist', async () => {
      prisma.subsystem.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope', STAFF)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('scopes the list to the staff member and not the admin', async () => {
      await service.list({ page: 1, limit: 20 }, STAFF);
      await service.list({ page: 1, limit: 20 }, ADMIN);

      expect(argsOf(prisma.subsystem.findMany, 0).where?.ownerId).toBe(
        STAFF.id,
      );
      expect(
        argsOf(prisma.subsystem.findMany, 1).where?.ownerId,
      ).toBeUndefined();
    });

    it('returns a paginated list with meta', async () => {
      prisma.subsystem.count.mockResolvedValue(41);

      const result = await service.list({ page: 2, limit: 20 }, ADMIN);

      expect(result).toBeInstanceOf(Paginated);
      expect(result.meta).toEqual({
        total: 41,
        page: 2,
        limit: 20,
        totalPages: 3,
      });
      expect(argsOf(prisma.subsystem.findMany)).toMatchObject({
        skip: 20,
        take: 20,
      });
    });
  });

  describe('editing an approved subsystem', () => {
    beforeEach(() =>
      prisma.subsystem.findUnique.mockResolvedValue(
        stored({ approvalStatus: 'APPROVED', status: 'ACTIVE' }),
      ),
    );

    it('refuses staff changing the callback URL (403)', async () => {
      await expect(
        service.update(
          'sub-1',
          { callbackUrl: 'http://localhost:4000/auth/callback' },
          STAFF,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses staff changing the role mapping (403)', async () => {
      await expect(
        service.updateRoleMapping(
          'sub-1',
          { defaultRoleMapping: { student: 'USER' } },
          STAFF,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets staff send the unchanged values back with a new display name', async () => {
      await expect(
        service.update(
          'sub-1',
          {
            displayName: 'ระบบครุภัณฑ์ (ใหม่)',
            callbackUrl: 'http://localhost:3002/auth/callback',
            defaultRoleMapping: { admin: 'ADMIN', staff: 'STAFF' },
          },
          STAFF,
        ),
      ).resolves.toBeDefined();
    });

    it('refuses staff changing the base URL (403)', async () => {
      await expect(
        service.update('sub-1', { baseUrl: 'http://localhost:4000' }, STAFF),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets staff send the stored base URL back unchanged', async () => {
      prisma.subsystem.findUnique.mockResolvedValue(
        stored({
          approvalStatus: 'APPROVED',
          status: 'ACTIVE',
          baseUrl: 'http://localhost:3002',
        }),
      );

      await expect(
        service.update(
          'sub-1',
          {
            displayName: 'ระบบครุภัณฑ์ (ใหม่)',
            baseUrl: 'http://localhost:3002',
          },
          STAFF,
        ),
      ).resolves.toBeDefined();
    });

    it('lets an admin set the base URL', async () => {
      await expect(
        service.update('sub-1', { baseUrl: 'http://localhost:4000' }, ADMIN),
      ).resolves.toMatchObject({ baseUrl: 'http://localhost:4000' });
    });

    it('lets the owner change category and description without a new review', async () => {
      await expect(
        service.update(
          'sub-1',
          { category: 'LEARNING', description: '  ยืม-คืนครุภัณฑ์ของสาขา  ' },
          STAFF,
        ),
      ).resolves.toBeDefined();
      expect(argsOf(prisma.subsystem.update).data).toMatchObject({
        category: 'LEARNING',
        description: 'ยืม-คืนครุภัณฑ์ของสาขา',
      });
    });

    it('stores a cleared description as null', async () => {
      await service.update('sub-1', { description: '   ' }, STAFF);
      expect(argsOf(prisma.subsystem.update).data).toMatchObject({
        description: null,
      });
    });

    it('refuses the owner hiding the subsystem from the menu (403)', async () => {
      await expect(
        service.update('sub-1', { listedInMenu: false }, STAFF),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an admin hide the subsystem from the menu', async () => {
      await expect(
        service.update('sub-1', { listedInMenu: false }, ADMIN),
      ).resolves.toBeDefined();
    });

    it('lets an admin change the callback URL', async () => {
      await expect(
        service.update(
          'sub-1',
          { callbackUrl: 'http://localhost:4000/auth/callback' },
          ADMIN,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('review', () => {
    it('records who rejected it and why', async () => {
      prisma.subsystem.findUnique.mockResolvedValue(stored());

      await service.reject('sub-1', 'callback ไม่ตรงกับระบบจริง', ADMIN);

      const { data } = argsOf(prisma.subsystem.update);
      expect(data).toMatchObject({
        approvalStatus: 'REJECTED',
        reviewedById: ADMIN.id,
        rejectionReason: 'callback ไม่ตรงกับระบบจริง',
      });
      expect(data.events?.create).toMatchObject({
        action: 'REJECTED',
        reason: 'callback ไม่ตรงกับระบบจริง',
      });
    });

    it('puts a rejected subsystem back in the queue on resubmit', async () => {
      prisma.subsystem.findUnique.mockResolvedValue(
        stored({ approvalStatus: 'REJECTED', rejectionReason: 'x' }),
      );

      await service.resubmit('sub-1', STAFF);

      expect(argsOf(prisma.subsystem.update).data).toMatchObject({
        approvalStatus: 'PENDING',
        rejectionReason: null,
      });
    });

    it('refuses resubmitting something that was not rejected (409)', async () => {
      prisma.subsystem.findUnique.mockResolvedValue(stored());

      await expect(service.resubmit('sub-1', STAFF)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("refuses resubmitting someone else's subsystem (403)", async () => {
      prisma.subsystem.findUnique.mockResolvedValue(
        stored({ approvalStatus: 'REJECTED', ownerId: 'user-999' }),
      );

      await expect(service.resubmit('sub-1', STAFF)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('lifecycle', () => {
    it('keeps the suspension reason and logs it', async () => {
      prisma.subsystem.findUnique.mockResolvedValue(
        stored({ approvalStatus: 'APPROVED', status: 'ACTIVE' }),
      );

      await service.suspend('sub-1', 'ละเมิดมาตรฐาน SEC-01', ADMIN);

      expect(argsOf(prisma.subsystem.update).data).toMatchObject({
        status: 'SUSPENDED',
        statusReason: 'ละเมิดมาตรฐาน SEC-01',
      });
    });

    it('clears the status reason when reactivated', async () => {
      prisma.subsystem.findUnique.mockResolvedValue(
        stored({
          approvalStatus: 'APPROVED',
          status: 'SUSPENDED',
          statusReason: 'x',
        }),
      );

      await service.activate('sub-1', ADMIN);

      expect(argsOf(prisma.subsystem.update).data).toMatchObject({
        status: 'ACTIVE',
        statusReason: null,
      });
    });

    it('refuses deleting an active subsystem (409)', async () => {
      prisma.subsystem.findUnique.mockResolvedValue(
        stored({ approvalStatus: 'APPROVED', status: 'ACTIVE' }),
      );

      await expect(service.delete('sub-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.subsystem.delete).not.toHaveBeenCalled();
    });

    it('answers a delete with { id, deleted: true }', async () => {
      prisma.subsystem.findUnique.mockResolvedValue(stored());

      await expect(service.delete('sub-1')).resolves.toEqual({
        id: 'sub-1',
        deleted: true,
      });
    });
  });

  describe('directory', () => {
    it('lists only live subsystems the role may enter', async () => {
      prisma.subsystem.findMany.mockResolvedValue([
        {
          id: 'a',
          name: 'a',
          displayName: 'A',
          defaultRoleMapping: { staff: 'S' },
        },
        {
          id: 'b',
          name: 'b',
          displayName: 'B',
          defaultRoleMapping: { student: 'U' },
        },
      ]);

      const result = await service.directory({ role: 'student' });

      expect(argsOf(prisma.subsystem.findMany).where).toEqual({
        approvalStatus: 'APPROVED',
        status: 'ACTIVE',
        listedInMenu: true,
      });
      expect(result.map((s) => s.id)).toEqual(['b']);
    });

    it('hands the menu each entry with its category and description', async () => {
      prisma.subsystem.findMany.mockResolvedValue([
        {
          id: 'b',
          name: 'b',
          displayName: 'B',
          category: 'LEARNING',
          description: 'เช็คชื่อเข้าเรียน',
          defaultRoleMapping: { student: 'U' },
        },
      ]);

      const [entry] = await service.directory({ role: 'student' });

      expect(entry).toEqual({
        id: 'b',
        name: 'b',
        displayName: 'B',
        category: 'LEARNING',
        description: 'เช็คชื่อเข้าเรียน',
        defaultRoleMapping: { student: 'U' },
      });
    });

    it('also lists a subsystem an approved exception opens', async () => {
      const live = (id: string, mapping: object, exceptions: object[]) => ({
        id,
        name: id,
        displayName: id.toUpperCase(),
        defaultRoleMapping: mapping,
        exceptions,
      });
      prisma.subsystem.findMany.mockResolvedValue([
        live('a', { Staff: 'S' }, [
          {
            username: '6504101001',
            role: 'staff',
            status: 'APPROVED',
            updatedAt: new Date(),
          },
        ]),
        live('b', { student: 'U' }, []),
        live('c', { staff: 'S' }, []),
      ]);

      const result = await service.directory({
        role: 'student',
        username: '6504101001',
      });

      expect(result.map((s) => s.id)).toEqual(['a', 'b']);
      // The menu never sees exception rows.
      expect(result[0]).not.toHaveProperty('exceptions');
    });
  });
});
