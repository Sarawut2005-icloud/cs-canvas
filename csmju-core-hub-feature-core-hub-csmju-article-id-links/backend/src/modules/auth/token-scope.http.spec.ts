import { Logger, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { generateKeyPairSync } from 'crypto';
import { mkdtempSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';

import { AuthMethod } from '../../../generated/prisma/client';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { RateLimitStore } from '../../common/rate-limit/rate-limit.store';
import { NotificationsController } from '../notifications/notifications.controller';
import { NotificationsService } from '../notifications/notifications.service';
import { PeopleController } from '../people/people.controller';
import { PeopleImportService } from '../people/people-import.service';
import { PeopleService } from '../people/people.service';
import { RoomsController } from '../reference-data/rooms/rooms.controller';
import { RoomsService } from '../reference-data/rooms/rooms.service';
import { SubsystemHealthService } from '../subsystems/subsystem-health.service';
import { SubsystemsController } from '../subsystems/subsystems.controller';
import { StandardsVersionsService } from '../subsystems/standards-versions.service';
import { SubsystemsService } from '../subsystems/subsystems.service';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SUBSYSTEM_TOKEN_ALLOWED_KEY } from './decorators/subsystem-token-allowed.decorator';
import { MjuSsoService } from './mju-sso/mju-sso.service';
import { SessionService } from './sessions/session.service';
import { SsoService } from './sso.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * The three token kinds end to end (CORE_HUB_TOKEN_SCOPE 4 · T1–T7): real
 * RS256 keys, the real JwtStrategy, JwtAuthGuard, PermissionsGuard,
 * AuthService and SsoService, real controllers — only storage is faked.
 * No token value is ever printed.
 */

// @nestjs/mapped-types v12 ships ESM only, which CommonJS jest cannot load
// (subsystems.permissions.spec.ts). No body is validated here.
jest.mock('@nestjs/mapped-types', () => ({
  PartialType: (base: new () => object) => class extends base {},
}));

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const keyDir = mkdtempSync(join(tmpdir(), 'token-scope-'));
const publicKeyPath = join(keyDir, 'jwt-public.pem');
writeFileSync(publicKeyPath, publicKey);

const SUBSYSTEM = 'csmju-demo-subsystem';

interface Account {
  id: string;
  email: string;
  username: string;
  role: { name: string };
  profileImageId: null;
}
const ACCOUNTS: Record<string, Account> = {
  student: {
    id: 'user-x',
    email: 'x@core.local',
    username: '6504101001',
    role: { name: 'student' },
    profileImageId: null,
  },
  staff: {
    id: 'user-s',
    email: 's@core.local',
    username: 'staff01',
    role: { name: 'staff' },
    profileImageId: null,
  },
};

interface Session {
  id: string;
  userId: string;
  status: 'ACTIVE' | 'REVOKED';
  expiresAt: Date;
  refreshTokenHash: string;
  authMethod: string;
  createdAt: Date;
}

const decode = (token: string) =>
  JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString(),
  ) as Record<string, unknown>;

describe('Core Hub token scope over HTTP', () => {
  let app: NestExpressApplication;
  let auth: AuthService;
  let jwt: JwtService;
  let sessions: Map<string, Session>;
  let exceptions: object[];
  let warn: jest.SpyInstance;
  const people = {
    findMe: jest.fn(() => Promise.resolve(null)),
    list: jest.fn(() => Promise.resolve([])),
  };
  const rooms = { list: jest.fn(() => Promise.resolve([])) };
  const users = {
    findById: jest.fn((id: string) =>
      Promise.resolve(Object.values(ACCOUNTS).find((a) => a.id === id) ?? null),
    ),
    linkedPersonStatus: jest.fn(() => Promise.resolve(null)),
    findPasswordHash: jest.fn(() => Promise.resolve(null)),
    setPassword: jest.fn(() => Promise.resolve(0)),
    changePassword: jest.fn(() =>
      Promise.resolve({ ok: true, revokedSessions: 1 }),
    ),
    findAll: jest.fn(() => Promise.resolve([])),
    effectivePermissions: jest.fn(() => Promise.resolve([])),
    grantPermission: jest.fn(() => Promise.resolve({})),
    revokePermission: jest.fn(() => Promise.resolve({})),
  };

  beforeAll(async () => {
    let next = 0;
    sessions = new Map();
    const sessionService = {
      createSessionId: () => `sid-${++next}`,
      createSession: (
        id: string,
        userId: string,
        expiresAt: Date,
        refreshTokenHash: string,
        authMethod: string,
      ) => {
        sessions.set(id, {
          id,
          userId,
          status: 'ACTIVE',
          expiresAt,
          refreshTokenHash,
          authMethod,
          createdAt: new Date(),
        });
        return Promise.resolve();
      },
      getSession: (id: string) => Promise.resolve(sessions.get(id) ?? null),
      revokeSession: (id: string) => {
        const session = sessions.get(id);
        if (session) session.status = 'REVOKED';
        return Promise.resolve(!!session);
      },
      revokeAllUserSessions: (userId: string) => {
        let count = 0;
        for (const s of sessions.values()) {
          if (s.userId === userId && s.status === 'ACTIVE') {
            s.status = 'REVOKED';
            count++;
          }
        }
        return Promise.resolve(count);
      },
      updateRefreshTokenHash: (id: string, hash: string, previous: string) => {
        const session = sessions.get(id);
        if (!session || session.refreshTokenHash !== previous) {
          return Promise.resolve(false);
        }
        session.refreshTokenHash = hash;
        return Promise.resolve(true);
      },
    };

    const config = {
      get: (key: string, fallback?: unknown) =>
        ({
          'jwt.publicKeyPath': publicKeyPath,
          'jwt.expiresIn': '15m',
          'jwt.refreshExpiresIn': '7d',
          'rateLimit.loginLockout': { limit: 10, windowSec: 900 },
        })[key] ?? fallback,
    };

    const registry = {
      findByIdentifier: jest.fn(() =>
        Promise.resolve({
          id: 'sub-demo',
          name: SUBSYSTEM,
          displayName: 'Demo',
          callbackUrl: 'http://localhost:3201/auth/callback',
          approvalStatus: 'APPROVED',
          status: 'ACTIVE',
          defaultRoleMapping: { student: 'USER', staff: 'STAFF' },
          exceptions,
        }),
      ),
      registrableUrlProblem: jest.fn(() => null),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          privateKey,
          publicKey,
          signOptions: { algorithm: 'RS256', expiresIn: '15m' },
        }),
      ],
      controllers: [
        AuthController,
        RoomsController,
        PeopleController,
        UsersController,
        NotificationsController,
        SubsystemsController,
      ],
      providers: [
        AuthService,
        SsoService,
        JwtStrategy,
        RateLimitStore,
        { provide: ConfigService, useValue: config },
        { provide: SessionService, useValue: sessionService },
        { provide: UsersService, useValue: users },
        { provide: SubsystemsService, useValue: registry },
        { provide: MjuSsoService, useValue: {} },
        { provide: RoomsService, useValue: rooms },
        { provide: PeopleService, useValue: people },
        { provide: PeopleImportService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: SubsystemHealthService, useValue: {} },
        { provide: StandardsVersionsService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    auth = app.get(AuthService);
    jwt = app.get(JwtService);
  });

  afterAll(() => app.close());

  beforeEach(() => {
    exceptions = [];
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function signIn(who: keyof typeof ACCOUNTS) {
    const pair = await auth.issueSession(ACCOUNTS[who], AuthMethod.PASSWORD);
    return { web: pair.access_token, refresh: pair.refresh_token };
  }

  async function handoff(web: string) {
    const res = await http()
      .get(`/auth/sso/handoff?subsystem=${SUBSYSTEM}`)
      .set(bearer(web));
    expect(res.status).toBe(200);
    return (res.body as { access_token: string }).access_token;
  }

  it('T1 · the handoff token carries azp, aud=csmju2030 and lives 900 s', async () => {
    const claims = decode(await handoff((await signIn('student')).web));

    expect(claims).toMatchObject({
      iss: 'core-hub',
      aud: 'csmju2030',
      azp: SUBSYSTEM,
      role: 'student',
    });
    expect(Number(claims.exp) - Number(claims.iat)).toBe(900);
  });

  it('T2 · the handoff token reads the allowed data endpoints', async () => {
    const token = await handoff((await signIn('student')).web);

    expect((await http().get('/rooms').set(bearer(token))).status).toBe(200);
    expect((await http().get('/people/me').set(bearer(token))).status).toBe(
      200,
    );
    expect((await http().get('/auth/me').set(bearer(token))).status).toBe(200);
  });

  it.each([
    ['post', '/auth/password/set', 'student'],
    ['post', '/auth/logout-all', 'student'],
    ['post', '/auth/change-password', 'student'],
    ['get', '/users', 'staff'],
    ['get', '/notifications', 'student'],
    ['get', '/subsystems', 'staff'],
    ['get', '/people/me/schedule', 'student'],
    ['get', `/auth/sso/handoff?subsystem=${SUBSYSTEM}`, 'student'],
    ['post', '/rooms', 'staff'],
    ['get', '/subsystems/standards-versions', 'staff'],
    ['get', '/subsystems/change-requests', 'staff'],
    ['post', '/subsystems/sub-demo/change-requests', 'staff'],
    ['get', '/subsystems/sub-demo/change-requests', 'staff'],
    ['post', '/subsystems/sub-demo/change-requests/req-1/approve', 'staff'],
    ['post', '/subsystems/sub-demo/change-requests/req-1/reject', 'staff'],
    ['post', '/subsystems/sub-demo/change-requests/req-1/cancel', 'staff'],
    ['get', '/subsystems/sub-demo/history', 'staff'],
    ['put', '/users/user-002/permissions/subsystem:create', 'staff'],
    ['delete', '/users/user-002/permissions/subsystem:create', 'staff'],
  ] as const)(
    'T3 · %s %s with a handoff token → 403 FORBIDDEN',
    async (method, path, who) => {
      const { web } = await signIn(who);
      const token = await handoff(web);
      const sid = String(decode(token).sid);

      const res = await http()[method](path).set(bearer(token)).send({
        currentPassword: 'x',
        newPassword: 'Another-Passw0rd!',
      });

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        'FORBIDDEN',
      );
      // Nothing ran: the user's session is untouched.
      expect(sessions.get(sid)?.status).toBe('ACTIVE');
      expect(users.setPassword).not.toHaveBeenCalled();
      expect(users.changePassword).not.toHaveBeenCalled();
    },
  );

  it('T3 · logs the refusal with azp and the path only — no query, no token', async () => {
    const token = await handoff((await signIn('staff')).web);

    await http().get('/users?q=Somchai').set(bearer(token));

    const lines = (warn.mock.calls as unknown[][]).map((call) =>
      String(call[0]),
    );
    const refusal = lines.find((l) =>
      l.includes('auth.subsystem_token_refused'),
    );
    expect(JSON.parse(refusal!)).toEqual({
      event: 'auth.subsystem_token_refused',
      azp: SUBSYSTEM,
      method: 'GET',
      path: '/users',
    });
    expect(lines.join('\n')).not.toContain(token);
    expect(lines.join('\n')).not.toContain('Somchai');
  });

  it('T4 · the web token keeps working everywhere it did', async () => {
    const { web } = await signIn('staff');

    expect((await http().get('/users').set(bearer(web))).status).toBe(200);
    expect(
      (
        await http()
          .post('/auth/password/set')
          .set(bearer(web))
          .send({ newPassword: 'Another-Passw0rd!' })
      ).status,
    ).toBe(200);
    expect(
      (
        await http()
          .post('/auth/change-password')
          .set(bearer(web))
          .send({ currentPassword: 'x', newPassword: 'Another-Passw0rd!' })
      ).status,
    ).toBe(200);
  });

  it('T5 · the refresh token has aud=core-hub-refresh and is no Bearer token', async () => {
    const { refresh } = await signIn('student');

    expect(decode(refresh).aud).toBe('core-hub-refresh');
    expect((await http().get('/rooms').set(bearer(refresh))).status).toBe(401);
  });

  it('T5 · a pre-split refresh token (aud=csmju2030, 7 days) is no Bearer token either', async () => {
    const { web } = await signIn('student');
    const claims = decode(web);
    const legacy = jwt.sign(
      {
        sub: claims.sub,
        email: claims.email,
        role: claims.role,
        sid: claims.sid,
        iss: 'core-hub',
        aud: 'csmju2030',
      },
      { expiresIn: '7d', keyid: 'core-hub-2026' },
    );

    expect((await http().get('/rooms').set(bearer(legacy))).status).toBe(401);
    // …and /auth/refresh no longer takes it (2.6: sign in again once).
    expect(
      (await http().post('/auth/refresh').send({ refresh_token: legacy }))
        .status,
    ).toBe(401);
  });

  it.each(['web', 'handoff'] as const)(
    'T6 · a %s token at /auth/refresh → 401 and the session stays ACTIVE',
    async (kind) => {
      const { web } = await signIn('student');
      const token = kind === 'web' ? web : await handoff(web);

      const res = await http()
        .post('/auth/refresh')
        .send({ refresh_token: token });

      expect(res.status).toBe(401);
      expect(sessions.get(String(decode(web).sid))?.status).toBe('ACTIVE');
    },
  );

  it('T6 · the real refresh token still rotates', async () => {
    const { refresh } = await signIn('student');

    const res = await http()
      .post('/auth/refresh')
      .send({ refresh_token: refresh });

    expect(res.status).toBe(201);
    const body = res.body as { access_token: string; refresh_token: string };
    expect(decode(body.access_token).aud).toBe('csmju2030');
    expect(decode(body.access_token)).not.toHaveProperty('azp');
    expect(decode(body.refresh_token).aud).toBe('core-hub-refresh');
  });

  it('T7 · an approved exception changes the token role, never Core Hub permissions', async () => {
    exceptions = [
      {
        username: ACCOUNTS.student.username,
        role: 'staff',
        status: 'APPROVED',
        updatedAt: new Date(),
      },
    ];
    const token = await handoff((await signIn('student')).web);

    expect(decode(token).role).toBe('staff');
    // Core Hub still decides from the account role in the database.
    expect((await http().get('/people').set(bearer(token))).status).toBe(403);
    expect(people.list).not.toHaveBeenCalled();
  });

  it('logging out ends the handoff token too (same sid)', async () => {
    const { web } = await signIn('student');
    const token = await handoff(web);

    await http().post('/auth/logout').set(bearer(web)).expect(201);

    expect((await http().get('/rooms').set(bearer(token))).status).toBe(401);
  });
});

/**
 * The allowlist itself (2.2) — read off every controller in the codebase, so
 * a route that is added or opted in later fails here until the PL agrees.
 */
describe('subsystem-token allowlist', () => {
  const ALLOWED = [
    'GET /academic-terms',
    'GET /academic-terms/current',
    'GET /academic-terms/:code',
    'GET /academic-terms/:code/events',
    'GET /buildings',
    'GET /buildings/:code',
    'GET /courses',
    'GET /courses/:code',
    'GET /curricula',
    'GET /curricula/:code',
    'GET /curricula/:code/structure',
    'GET /curricula/:code/study-plan',
    'GET /departments',
    'GET /departments/:code',
    'GET /faculties',
    'GET /faculties/:code',
    'GET /rooms',
    'GET /rooms/:code',
    'GET /people/me',
    'GET /people',
    'GET /people/:personCode',
    'GET /people/:personCode/advisors',
    'GET /people/:personCode/advisees',
    'GET /auth/me',
    'POST /images',
    'GET /images',
    'GET /images/:id',
    'DELETE /images/:id',
  ].sort();

  function controllersInCodebase(): (new (...args: never[]) => object)[] {
    const root = join(__dirname, '..', '..');
    return readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.controller.ts'))
      .flatMap((file) =>
        Object.values(
          // Every controller file, including ones added later.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require(join(root, file)) as Record<string, unknown>,
        ),
      )
      .filter(
        (value): value is new (...args: never[]) => object =>
          typeof value === 'function' &&
          Reflect.getMetadata(PATH_METADATA, value) !== undefined,
      );
  }

  it('is exactly the list in CORE_HUB_TOKEN_SCOPE 2.2', () => {
    const allowed: string[] = [];

    for (const controller of controllersInCodebase()) {
      const base = String(Reflect.getMetadata(PATH_METADATA, controller));
      const classAllowed = Reflect.getMetadata(
        SUBSYSTEM_TOKEN_ALLOWED_KEY,
        controller,
      ) as boolean | undefined;

      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = (controller.prototype as Record<string, unknown>)[name];
        if (typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as
          RequestMethod | undefined;
        if (method === undefined) continue;

        const handlerAllowed = Reflect.getMetadata(
          SUBSYSTEM_TOKEN_ALLOWED_KEY,
          handler,
        ) as boolean | undefined;
        if (!(handlerAllowed ?? classAllowed)) continue;

        const path =
          `/${base}/${String(Reflect.getMetadata(PATH_METADATA, handler))}`
            .replace(/\/+/g, '/')
            .replace(/\/$/, '');
        allowed.push(`${RequestMethod[method]} ${path}`);
      }
    }

    expect(allowed.sort()).toEqual(ALLOWED);
  });
});
