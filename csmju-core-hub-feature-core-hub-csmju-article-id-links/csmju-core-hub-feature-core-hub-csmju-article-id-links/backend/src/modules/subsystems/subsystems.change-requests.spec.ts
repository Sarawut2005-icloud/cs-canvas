import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PrismaService } from '../../database/prisma.service';
import { CreateChangeRequestDto } from './dto/change-request.dto';
import { StandardsVersionsService } from './standards-versions.service';
import { anyStandardsVersion } from './standards-versions.stub';
import { SubsystemActor, SubsystemsService } from './subsystems.service';

// Mock data only.
const OWNER: SubsystemActor = { id: 'user-owner', role: 'staff' };
const OTHER_STAFF: SubsystemActor = { id: 'user-other', role: 'staff' };
const ADMIN: SubsystemActor = { id: 'user-admin', role: 'admin' };

type Row = Record<string, unknown>;

/**
 * A small in-memory registry — enough of Prisma for the change-request flow,
 * including interactive transactions (which run against the same store).
 */
function fakeRegistry() {
  const subsystem: Row = {
    id: 'sub-1',
    name: 'demo-subsystem',
    displayName: 'Demo',
    category: 'OTHER',
    description: 'A demo',
    listedInMenu: true,
    ownerId: OWNER.id,
    repo: 'org/demo',
    standardsVersion: '1.0',
    defaultRoleMapping: { student: 'STUDENT' },
    callbackUrl: 'https://demo.example/auth/callback',
    baseUrl: 'https://demo.example',
    approvalStatus: 'APPROVED',
    status: 'ACTIVE',
  };
  const requests: Row[] = [];
  const events: Row[] = [];
  let seq = 0;

  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([key, value]) =>
      value === undefined
        ? true
        : typeof value === 'object' && value !== null && 'not' in value
          ? row[key] !== value.not
          : row[key] === value,
    );

  const tables = {
    subsystem: {
      findUnique: jest.fn(({ where }: { where: Row }) =>
        Promise.resolve(where.id === subsystem.id ? { ...subsystem } : null),
      ),
      update: jest.fn(({ data }: { data: Row }) => {
        const { events: nested, ...fields } = data as {
          events?: { create: Row };
        } & Row;
        Object.assign(
          subsystem,
          Object.fromEntries(
            Object.entries(fields).filter(([, v]) => v !== undefined),
          ),
        );
        if (nested)
          events.push({ subsystemId: subsystem.id, ...nested.create });
        return Promise.resolve({ ...subsystem });
      }),
    },
    user: { findUnique: jest.fn(() => Promise.resolve(null)) },
    subsystemChangeRequest: {
      findFirst: jest.fn(({ where }: { where: Row }) =>
        Promise.resolve(requests.find((r) => matches(r, where)) ?? null),
      ),
      findUniqueOrThrow: jest.fn(({ where }: { where: Row }) =>
        Promise.resolve({ ...requests.find((r) => r.id === where.id)! }),
      ),
      count: jest.fn(({ where }: { where: Row }) =>
        Promise.resolve(requests.filter((r) => matches(r, where)).length),
      ),
      create: jest.fn(({ data }: { data: Row }) => {
        const row = { id: `req-${++seq}`, status: 'PENDING', ...data };
        requests.push(row);
        return Promise.resolve({ ...row });
      }),
      updateMany: jest.fn(({ where, data }: { where: Row; data: Row }) => {
        const hit = requests.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return Promise.resolve({ count: hit.length });
      }),
      findMany: jest.fn(({ where }: { where: Row }) =>
        Promise.resolve(requests.filter((r) => matches(r, where))),
      ),
    },
    subsystemEvent: {
      create: jest.fn(({ data }: { data: Row }) => {
        events.push(data);
        return Promise.resolve(data);
      }),
      findMany: jest.fn(() => Promise.resolve([...events].reverse())),
      count: jest.fn(() => Promise.resolve(events.length)),
    },
  };
  // Interactive transactions run against the same store.
  const prisma = {
    ...tables,
    $transaction: jest.fn((arg: unknown): Promise<unknown> =>
      typeof arg === 'function'
        ? (arg as (tx: typeof tables) => Promise<unknown>)(tables)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };

  return { prisma, subsystem, requests, events };
}

function serviceFor(
  registry: ReturnType<typeof fakeRegistry>,
  opts: {
    environment?: string;
    allowLocalhost?: boolean;
    versions?: StandardsVersionsService;
  } = {},
) {
  const values: Record<string, unknown> = {
    'app.environment': opts.environment ?? 'production',
    'app.allowLocalhostCallbacks': opts.allowLocalhost ?? false,
  };
  const config = {
    get: <T>(key: string, fallback?: T): T =>
      (key in values ? values[key] : fallback) as T,
  } as unknown as ConfigService;

  return {
    service: new SubsystemsService(
      registry.prisma as unknown as PrismaService,
      config,
      opts.versions ?? anyStandardsVersion(),
    ),
    values,
  };
}

const NEW_CALLBACK = 'https://demo-v2.example/auth/callback';

describe('SubsystemsService — direct edits of an approved subsystem', () => {
  it('R1 · the owner changes displayName at once; history records from/to', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);

    await service.update('sub-1', { displayName: 'Demo v2' }, OWNER);

    expect(registry.subsystem.displayName).toBe('Demo v2');
    expect(registry.events.at(-1)).toMatchObject({
      action: 'UPDATED',
      actorId: OWNER.id,
      changes: { displayName: { from: 'Demo', to: 'Demo v2' } },
    });
  });

  it('R1 · unchanged fields sent back by the form are not recorded', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);

    await service.update(
      'sub-1',
      {
        displayName: 'Demo',
        repo: 'org/demo-v2',
        callbackUrl: registry.subsystem.callbackUrl as string,
        defaultRoleMapping: { student: 'STUDENT' },
      },
      OWNER,
    );

    expect(registry.events.at(-1)?.changes).toEqual({
      repo: { from: 'org/demo', to: 'org/demo-v2' },
    });
  });

  it('the owner changes category and clears the description; both recorded as stored', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);

    await service.update(
      'sub-1',
      { category: 'LEARNING', description: '  ' },
      OWNER,
    );

    expect(registry.events.at(-1)?.changes).toEqual({
      category: { from: 'OTHER', to: 'LEARNING' },
      description: { from: 'A demo', to: null },
    });
  });

  it('listedInMenu stays admin-only, and an admin change is recorded', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);

    await expect(
      service.update('sub-1', { listedInMenu: false }, OWNER),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await service.update('sub-1', { listedInMenu: false }, ADMIN);
    expect(registry.events.at(-1)?.changes).toEqual({
      listedInMenu: { from: true, to: false },
    });
  });

  it('R2 · the owner PATCHes callbackUrl → 403 that points to a change request', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);

    const error = await service
      .update('sub-1', { callbackUrl: NEW_CALLBACK }, OWNER)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as Error).message).toContain('change request');
    expect((error as Error).message).toContain(
      '/api/v1/subsystems/sub-1/change-requests',
    );
    expect(registry.subsystem.callbackUrl).not.toBe(NEW_CALLBACK);
  });

  it('a rename stays with administrators and is recorded', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);

    await expect(
      service.update('sub-1', { name: 'demo-renamed' }, OWNER),
    ).rejects.toThrow('only be changed by an administrator');

    await service.update('sub-1', { name: 'demo-renamed' }, ADMIN);
    expect(registry.events.at(-1)?.changes).toEqual({
      name: { from: 'demo-subsystem', to: 'demo-renamed' },
    });
  });
});

describe('SubsystemsService — change requests', () => {
  it('R3 · the owner asks for a new callbackUrl → PENDING, SSO keeps the old one', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);

    const request = await service.createChangeRequest(
      'sub-1',
      { callbackUrl: NEW_CALLBACK },
      OWNER,
    );

    expect(request).toMatchObject({
      status: 'PENDING',
      requestedById: OWNER.id,
      changes: { callbackUrl: NEW_CALLBACK },
    });
    expect(registry.subsystem.callbackUrl).toBe(
      'https://demo.example/auth/callback',
    );
    expect(registry.events.at(-1)).toMatchObject({
      action: 'CHANGE_REQUESTED',
      changes: {
        callbackUrl: {
          from: 'https://demo.example/auth/callback',
          to: NEW_CALLBACK,
        },
      },
    });
    // Serializable, so a racing second request fails instead of slipping in.
    expect(registry.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('R4 · a second request while one is pending → 409', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);

    await service.createChangeRequest(
      'sub-1',
      { callbackUrl: NEW_CALLBACK },
      OWNER,
    );

    await expect(
      service.createChangeRequest(
        'sub-1',
        { baseUrl: 'https://other.example' },
        OWNER,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(registry.requests).toHaveLength(1);
  });

  it('R4 · a serialization failure (two at once) is the same 409', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);
    registry.prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });

    await expect(
      service.createChangeRequest(
        'sub-1',
        { callbackUrl: NEW_CALLBACK },
        OWNER,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('R5 · the admin approves → the new callback applies at once, recorded with changes', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);
    const request = await service.createChangeRequest(
      'sub-1',
      {
        callbackUrl: NEW_CALLBACK,
        defaultRoleMapping: { student: 'STUDENT', lecturer: 'TEACHER' },
      },
      OWNER,
    );

    const approved = await service.approveChangeRequest(
      'sub-1',
      request.id,
      ADMIN,
    );

    expect(approved).toMatchObject({
      status: 'APPROVED',
      reviewedById: ADMIN.id,
    });
    expect(registry.subsystem).toMatchObject({
      callbackUrl: NEW_CALLBACK,
      defaultRoleMapping: { student: 'STUDENT', lecturer: 'TEACHER' },
      name: 'demo-subsystem', // the azp does not change
    });
    expect(registry.events.at(-1)).toMatchObject({
      action: 'CHANGE_APPROVED',
      actorId: ADMIN.id,
      changes: {
        callbackUrl: {
          from: 'https://demo.example/auth/callback',
          to: NEW_CALLBACK,
        },
        defaultRoleMapping: {
          from: { student: 'STUDENT' },
          to: { student: 'STUDENT', lecturer: 'TEACHER' },
        },
      },
    });

    await expect(
      service.approveChangeRequest('sub-1', request.id, ADMIN),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('R5 · approval checks the localhost rule again — flag switched off since → 400, still pending', async () => {
    const registry = fakeRegistry();
    const { service, values } = serviceFor(registry, { allowLocalhost: true });
    const request = await service.createChangeRequest(
      'sub-1',
      { callbackUrl: 'http://localhost:3201/auth/callback' },
      OWNER,
    );

    values['app.allowLocalhostCallbacks'] = false;

    await expect(
      service.approveChangeRequest('sub-1', request.id, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(registry.requests[0].status).toBe('PENDING');
    expect(registry.subsystem.callbackUrl).toBe(
      'https://demo.example/auth/callback',
    );
  });

  it('R6 · the admin rejects with a reason → nothing changes, history has the reason', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);
    const request = await service.createChangeRequest(
      'sub-1',
      { callbackUrl: NEW_CALLBACK },
      OWNER,
    );

    const rejected = await service.rejectChangeRequest(
      'sub-1',
      request.id,
      'Use the production domain',
      ADMIN,
    );

    expect(rejected).toMatchObject({
      status: 'REJECTED',
      reason: 'Use the production domain',
    });
    expect(registry.subsystem.callbackUrl).toBe(
      'https://demo.example/auth/callback',
    );
    expect(registry.events.at(-1)).toMatchObject({
      action: 'CHANGE_REJECTED',
      reason: 'Use the production domain',
      changes: { callbackUrl: { to: NEW_CALLBACK } },
    });
  });

  it('R6 · the owner cancels → CANCELLED, nothing changes; then a new request is allowed', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);
    const request = await service.createChangeRequest(
      'sub-1',
      { callbackUrl: NEW_CALLBACK },
      OWNER,
    );

    await expect(
      service.cancelChangeRequest('sub-1', request.id, OTHER_STAFF),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const cancelled = await service.cancelChangeRequest(
      'sub-1',
      request.id,
      OWNER,
    );

    expect(cancelled.status).toBe('CANCELLED');
    expect(registry.subsystem.callbackUrl).toBe(
      'https://demo.example/auth/callback',
    );
    expect(registry.events.at(-1)?.action).toBe('CHANGE_CANCELLED');

    await expect(
      service.createChangeRequest(
        'sub-1',
        { callbackUrl: NEW_CALLBACK },
        OWNER,
      ),
    ).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('R7 · an empty role mapping or an unknown key → 400 VALIDATION_ERROR (DTO)', async () => {
    for (const defaultRoleMapping of [
      {},
      { teacher: 'TEACHER' },
      { student: '' },
    ]) {
      const dto = plainToInstance(CreateChangeRequestDto, {
        defaultRoleMapping,
      });
      const errors = await validate(dto);
      expect(errors.map((e) => e.property)).toEqual(['defaultRoleMapping']);
    }
  });

  it('R7 · the service refuses a bad mapping too (null slips past @IsOptional)', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);

    await expect(
      service.createChangeRequest(
        'sub-1',
        { defaultRoleMapping: null as unknown as Record<string, string> },
        OWNER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses the name, an http callback in production, and a request that changes nothing', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);

    await expect(
      service.createChangeRequest(
        'sub-1',
        { name: 'other' } as unknown as CreateChangeRequestDto,
        OWNER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createChangeRequest(
        'sub-1',
        { callbackUrl: 'http://localhost:3201/auth/callback' },
        OWNER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createChangeRequest(
        'sub-1',
        { callbackUrl: registry.subsystem.callbackUrl as string },
        OWNER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(registry.requests).toHaveLength(0);
  });

  it('only an approved subsystem takes requests; only its owner (or an admin) asks', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);

    await expect(
      service.createChangeRequest(
        'sub-1',
        { callbackUrl: NEW_CALLBACK },
        OTHER_STAFF,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    registry.subsystem.approvalStatus = 'PENDING';
    await expect(
      service.createChangeRequest(
        'sub-1',
        { callbackUrl: NEW_CALLBACK },
        OWNER,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('an empty baseUrl asks to remove it (stored as null)', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);

    const request = await service.createChangeRequest(
      'sub-1',
      { baseUrl: '' },
      OWNER,
    );
    expect(request.changes).toEqual({ baseUrl: null });

    await service.approveChangeRequest('sub-1', request.id, ADMIN);
    expect(registry.subsystem.baseUrl).toBeNull();
  });
});

describe('SubsystemsService — standards version (handoff 2.7)', () => {
  const REGISTRATION = {
    name: 'new-subsystem',
    displayName: 'New',
    repo: 'org/new',
    defaultRoleMapping: { student: 'STUDENT' },
    callbackUrl: 'https://new.example/auth/callback',
  };

  function strictVersions(): StandardsVersionsService {
    return {
      list: () =>
        Promise.resolve({ versions: ['1.7.2', '1.0.6'], source: 'github' }),
      isKnown: (v: string) => Promise.resolve(['1.7.2', '1.0.6'].includes(v)),
    } as unknown as StandardsVersionsService;
  }

  it('R10 · registering with 9.9.9 → 400 VALIDATION_ERROR', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry, { versions: strictVersions() });

    const error = await service
      .create({ ...REGISTRATION, standardsVersion: '9.9.9' }, OWNER)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    // A message array → VALIDATION_ERROR through the exception filter.
    expect((error as BadRequestException).getResponse()).toMatchObject({
      message: [expect.stringContaining('1.7.2')],
    });
  });

  it('an old stored value (1.0) may be saved again, but not changed to an unknown one', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry, { versions: strictVersions() });

    await expect(
      service.update('sub-1', { standardsVersion: '1.0' }, OWNER),
    ).resolves.toBeDefined();
    await expect(
      service.update('sub-1', { standardsVersion: '9.9.9' }, OWNER),
    ).rejects.toBeInstanceOf(BadRequestException);

    await service.update('sub-1', { standardsVersion: '1.7.2' }, OWNER);
    expect(registry.events.at(-1)?.changes).toEqual({
      standardsVersion: { from: '1.0', to: '1.7.2' },
    });
  });
});

describe('SubsystemsService — history', () => {
  it('lists events newest first with changes, for the owner but not other staff', async () => {
    const registry = fakeRegistry();
    const { service } = serviceFor(registry);
    await service.update('sub-1', { displayName: 'Demo v2' }, OWNER);
    await service.createChangeRequest(
      'sub-1',
      { callbackUrl: NEW_CALLBACK },
      OWNER,
    );

    const page = await service.history('sub-1', { page: 1, limit: 20 }, OWNER);

    expect(page.items.map((e) => (e as { action: string }).action)).toEqual([
      'CHANGE_REQUESTED',
      'UPDATED',
    ]);
    await expect(
      service.history('sub-1', { page: 1, limit: 20 }, OTHER_STAFF),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
