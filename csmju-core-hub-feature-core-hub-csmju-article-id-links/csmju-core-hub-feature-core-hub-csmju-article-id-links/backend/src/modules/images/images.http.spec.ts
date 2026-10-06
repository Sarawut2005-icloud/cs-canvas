import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request, { type Response } from 'supertest';
import type { App } from 'supertest/types';

import { PrismaModule } from 'src/database/prisma.module';
import { PrismaService } from 'src/database/prisma.service';
import { HttpExceptionFilter } from 'src/common/filters/http-exception.filter';
import { ResponseInterceptor } from 'src/common/interceptors/response.interceptor';
import { RateLimitModule } from 'src/common/rate-limit/rate-limit.module';
import { Image } from '../../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImagesModule } from './images.module';

/** Stands in for JwtAuthGuard: `x-test-user` + `x-test-role` become request.user. */
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { id: string; role: string };
    }>();
    const id = req.headers['x-test-user'];
    const role = req.headers['x-test-role'];
    if (!id || !role) throw new UnauthorizedException();
    req.user = { id, role };
    return true;
  }
}

type Where = Record<string, unknown>;

function matches(row: Record<string, unknown>, where: Where = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && 'not' in expected) {
      return row[key] !== expected.not;
    }
    return row[key] === expected;
  });
}

/** The slice of PrismaService that ImagesService uses, kept in memory. */
class FakePrisma {
  images: Image[] = [];
  users = new Map<string, { id: string; profileImageId: string | null }>();
  subsystems = [
    {
      id: 'subsystem-news',
      name: 'news-service',
      approvalStatus: 'APPROVED',
      status: 'ACTIVE',
    },
    {
      id: 'subsystem-new',
      name: 'new-service',
      approvalStatus: 'PENDING',
      status: 'INACTIVE',
    },
    {
      id: 'subsystem-bad',
      name: 'bad-service',
      approvalStatus: 'REJECTED',
      status: 'INACTIVE',
    },
    {
      id: 'subsystem-off',
      name: 'off-service',
      approvalStatus: 'APPROVED',
      status: 'INACTIVE',
    },
    {
      id: 'subsystem-held',
      name: 'held-service',
      approvalStatus: 'APPROVED',
      status: 'SUSPENDED',
    },
  ];
  failNextImageCreate = false;

  subsystem = {
    findUnique: ({ where }: { where: { name: string } }) =>
      Promise.resolve(
        this.subsystems.find((s) => s.name === where.name) ?? null,
      ),
  };

  image = {
    create: ({ data }: { data: Omit<Image, 'updatedAt' | 'deletedAt'> }) => {
      if (this.failNextImageCreate) {
        this.failNextImageCreate = false;
        return Promise.reject(new Error('database is down'));
      }
      const row: Image = {
        ...data,
        updatedAt: data.createdAt,
        deletedAt: null,
      };
      this.images.push(row);
      return Promise.resolve(row);
    },
    findFirst: ({ where }: { where: Where }) =>
      Promise.resolve(this.images.find((row) => matches(row, where)) ?? null),
    findMany: ({
      where,
      skip,
      take,
    }: {
      where: Where;
      skip: number;
      take: number;
    }) =>
      Promise.resolve(
        this.images
          .filter((row) => matches(row, where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(skip, skip + take),
      ),
    count: ({ where }: { where: Where }) =>
      Promise.resolve(this.images.filter((row) => matches(row, where)).length),
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Image>;
    }) => {
      const row = this.images.find((image) => image.id === where.id)!;
      Object.assign(row, data);
      return Promise.resolve(row);
    },
    updateMany: ({ where, data }: { where: Where; data: Partial<Image> }) => {
      const rows = this.images.filter((row) => matches(row, where));
      rows.forEach((row) => Object.assign(row, data));
      return Promise.resolve({ count: rows.length });
    },
  };

  user = {
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: { profileImageId: string };
    }) => {
      const user = this.users.get(where.id) ?? {
        id: where.id,
        profileImageId: null,
      };
      user.profileImageId = data.profileImageId;
      this.users.set(where.id, user);
      return Promise.resolve(user);
    },
    updateMany: ({
      where,
      data,
    }: {
      where: { profileImageId: string };
      data: { profileImageId: null };
    }) => {
      let count = 0;
      for (const user of this.users.values()) {
        if (user.profileImageId === where.profileImageId) {
          user.profileImageId = data.profileImageId;
          count += 1;
        }
      }
      return Promise.resolve({ count });
    },
  };

  $transaction(work: unknown): Promise<unknown> {
    if (Array.isArray(work)) return Promise.all(work);
    return (work as (tx: this) => Promise<unknown>)(this);
  }
}

const UPLOAD_LIMIT = 12;

const STUDENT = { 'x-test-user': 'user-student', 'x-test-role': 'student' };
const OTHER_STUDENT = { 'x-test-user': 'user-other', 'x-test-role': 'student' };
const STAFF = { 'x-test-user': 'user-staff', 'x-test-role': 'staff' };
const ADMIN = { 'x-test-user': 'user-admin', 'x-test-role': 'admin' };

const jpeg = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#c33' } })
    .jpeg()
    .toBuffer();

interface Envelope<T> {
  success: boolean;
  data: T;
  meta: { total: number; page: number; limit: number };
  error: { code: string; details?: string[] };
}

function json<T = unknown>(res: Response): Envelope<T> {
  return res.body as Envelope<T>;
}

interface ImageBody {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  category: string;
  subsystemId: string | null;
  uploadedById: string;
}

describe('Images API (HTTP)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrisma;
  let uploads: string;

  beforeEach(async () => {
    uploads = await mkdtemp(path.join(tmpdir(), 'core-hub-images-'));
    prisma = new FakePrisma();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              app: { publicUrl: 'https://core.test' },
              uploads: { dir: uploads },
              // Only the upload ceiling, set low enough to reach in a test.
              rateLimit: {
                ip: [],
                user: [],
                routes: { imageUpload: { limit: UPLOAD_LIMIT, windowSec: 60 } },
              },
            }),
          ],
        }),
        PrismaModule,
        RateLimitModule,
        ImagesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    // Same pipeline as main.ts.
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    await rm(uploads, { recursive: true, force: true });
  });

  async function upload(
    headers: Record<string, string>,
    category: string,
    file: Buffer | null,
    extra: Record<string, string> = {},
  ) {
    const req = request(app.getHttpServer())
      .post('/api/v1/images')
      .set(headers)
      .field('category', category);
    for (const [name, value] of Object.entries(extra)) req.field(name, value);
    if (file) req.attach('file', file, 'photo.jpg');
    return req;
  }

  const fileOf = (id: string, query = '') =>
    request(app.getHttpServer())
      .get(`/api/v1/images/${id}/file${query}`)
      .buffer(true)
      // Collect the image bytes into a Buffer instead of parsing them.
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });

  describe('POST /api/v1/images', () => {
    it('stores a news image and returns absolute URLs, never the disk path', async () => {
      const res = await upload(STAFF, 'NEWS', await jpeg(3000, 1500), {
        subsystem: 'news-service',
      });

      expect(res.status).toBe(201);
      expect(json(res).success).toBe(true);
      const body = json<ImageBody>(res).data;
      expect(body).toMatchObject({
        category: 'NEWS',
        width: 1920,
        height: 960,
        mimeType: 'image/webp',
        subsystemId: 'subsystem-news',
        uploadedById: 'user-staff',
        url: `https://core.test/api/v1/images/${body.id}/file`,
        thumbnailUrl: `https://core.test/api/v1/images/${body.id}/file?size=thumb`,
      });
      expect(JSON.stringify(res.body)).not.toContain(uploads);
      expect(json(res).data).not.toHaveProperty('storagePath');

      const month = new Date().toISOString().slice(0, 7);
      expect((await readdir(path.join(uploads, 'news', month))).sort()).toEqual(
        [`${body.id}.thumb.webp`, `${body.id}.webp`],
      );
    });

    it('lets a student upload profile and general images but not a news image', async () => {
      expect(
        (await upload(STUDENT, 'PROFILE', await jpeg(800, 800))).status,
      ).toBe(201);
      expect(
        (await upload(STUDENT, 'GENERAL', await jpeg(800, 800))).status,
      ).toBe(201);

      const res = await upload(STUDENT, 'NEWS', await jpeg(800, 800));
      expect(res.status).toBe(403);
      expect(json(res).error.code).toBe('FORBIDDEN');
    });

    it('answers 429 once an IP passes the upload ceiling, before storing anything', async () => {
      const small = await jpeg(10, 10);
      for (let i = 0; i < UPLOAD_LIMIT; i += 1) {
        await upload(STUDENT, 'PROFILE', small);
      }
      const stored = prisma.images.length;

      const res = await upload(STUDENT, 'PROFILE', small);

      expect(res.status).toBe(429);
      expect(json(res).error.code).toBe('TOO_MANY_REQUESTS');
      expect(res.headers['retry-after']).toBeDefined();
      expect(prisma.images).toHaveLength(stored);
    });

    it('makes a new profile picture current and retires the old one', async () => {
      const first = json<ImageBody>(
        await upload(STUDENT, 'PROFILE', await jpeg(600, 600)),
      ).data;
      const second = json<ImageBody>(
        await upload(STUDENT, 'PROFILE', await jpeg(600, 600)),
      ).data;

      expect(prisma.users.get('user-student')?.profileImageId).toBe(second.id);
      expect((await fileOf(first.id)).status).toBe(404);
      expect((await fileOf(second.id)).status).toBe(200);
    });

    it.each([
      [
        'an SVG',
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
        'file must be a JPEG, PNG or WebP image',
      ],
      [
        'a file over 10 MB',
        Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.alloc(10 * 1024 * 1024),
        ]),
        'file must be at most 10 MB',
      ],
    ])('rejects %s with 400 VALIDATION_ERROR', async (_name, file, message) => {
      const res = await upload(STAFF, 'NEWS', file);

      expect(res.status).toBe(400);
      expect(json(res).error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [message],
      });
      expect(prisma.images).toHaveLength(0);
    });

    it('requires a file, a known category and an approved, active subsystem', async () => {
      expect(json(await upload(STAFF, 'NEWS', null)).error.details).toEqual([
        'file is required',
      ]);
      expect(
        json(await upload(STAFF, 'AVATAR', await jpeg(10, 10))).error.code,
      ).toBe('VALIDATION_ERROR');
      expect(
        json(
          await upload(STAFF, 'NEWS', await jpeg(10, 10), {
            subsystem: 'nope',
          }),
        ).error.details,
      ).toEqual(['subsystem "nope" is not registered']);
      for (const subsystem of ['new-service', 'bad-service']) {
        expect(
          json(await upload(STAFF, 'NEWS', await jpeg(10, 10), { subsystem }))
            .error.details,
        ).toEqual([`subsystem "${subsystem}" is not approved`]);
      }
      for (const subsystem of ['off-service', 'held-service']) {
        expect(
          json(await upload(STAFF, 'NEWS', await jpeg(10, 10), { subsystem }))
            .error.details,
        ).toEqual([`subsystem "${subsystem}" is not active`]);
      }
      expect(prisma.images).toHaveLength(0);
    });

    it('removes the written files when the database insert fails', async () => {
      prisma.failNextImageCreate = true;

      const res = await upload(STAFF, 'NEWS', await jpeg(1000, 500));

      expect(res.status).toBe(500);
      const month = new Date().toISOString().slice(0, 7);
      expect(await readdir(path.join(uploads, 'news', month))).toEqual([]);
    });

    it('rejects a caller without a token', async () => {
      const res = await upload({}, 'PROFILE', await jpeg(10, 10));
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/images/:id/file (public)', () => {
    it('serves raw WebP bytes without a token, cacheable and nosniff', async () => {
      const { id } = json<ImageBody>(
        await upload(STAFF, 'NEWS', await jpeg(1600, 900)),
      ).data;

      const res = await fileOf(id);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/webp');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('public, max-age=86400');
      const stored = await sharp(res.body as Buffer).metadata();
      expect([stored.format, stored.width, stored.height]).toEqual([
        'webp',
        1600,
        900,
      ]);
    });

    it('serves the thumbnail, or the full image when there is none', async () => {
      const news = json<ImageBody>(
        await upload(STAFF, 'NEWS', await jpeg(1600, 900)),
      ).data;
      const profile = json<ImageBody>(
        await upload(STAFF, 'PROFILE', await jpeg(300, 300)),
      ).data;

      const thumb = await sharp(
        (await fileOf(news.id, '?size=thumb')).body as Buffer,
      ).metadata();
      expect([thumb.width, thumb.height]).toEqual([400, 225]);

      const fallback = await sharp(
        (await fileOf(profile.id, '?size=thumb')).body as Buffer,
      ).metadata();
      expect([fallback.width, fallback.height]).toEqual([300, 300]);
    });

    it('answers 404 for an unknown or malformed id', async () => {
      expect(
        (await fileOf('3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b')).status,
      ).toBe(404);
      expect((await fileOf('../../etc/passwd')).status).toBe(404);
      expect((await fileOf('not-a-uuid')).status).toBe(404);
    });
  });

  describe('reading and deleting', () => {
    it('lists only your own uploads unless you may read any', async () => {
      await upload(STUDENT, 'PROFILE', await jpeg(100, 100));
      await upload(STAFF, 'NEWS', await jpeg(100, 100));
      await upload(STAFF, 'GENERAL', await jpeg(100, 100));

      const mine = await request(app.getHttpServer())
        .get('/api/v1/images')
        .set(STAFF);
      expect(json(mine).meta).toMatchObject({ total: 2, page: 1, limit: 20 });
      expect(
        json<ImageBody[]>(mine).data.every(
          (image) => image.uploadedById === 'user-staff',
        ),
      ).toBe(true);

      const news = await request(app.getHttpServer())
        .get('/api/v1/images?category=NEWS')
        .set(ADMIN);
      expect(json(news).meta.total).toBe(1);

      const all = await request(app.getHttpServer())
        .get('/api/v1/images')
        .set(ADMIN);
      expect(json(all).meta.total).toBe(3);
    });

    it("keeps other people's image details from students", async () => {
      const { id } = json<ImageBody>(
        await upload(STUDENT, 'PROFILE', await jpeg(50, 50)),
      ).data;

      const get = (headers: Record<string, string>) =>
        request(app.getHttpServer()).get(`/api/v1/images/${id}`).set(headers);

      expect((await get(STUDENT)).status).toBe(200);
      expect((await get(OTHER_STUDENT)).status).toBe(403);
      expect((await get(ADMIN)).status).toBe(200);
    });

    it('lets the uploader or an admin delete, then the file is gone', async () => {
      const { id } = json<ImageBody>(
        await upload(STUDENT, 'PROFILE', await jpeg(50, 50)),
      ).data;
      const del = (headers: Record<string, string>) =>
        request(app.getHttpServer())
          .delete(`/api/v1/images/${id}`)
          .set(headers);

      expect((await del(OTHER_STUDENT)).status).toBe(403);

      const res = await del(STUDENT);
      expect(res.status).toBe(200);
      expect(json(res).data).toEqual({ id, deleted: true });
      expect(prisma.users.get('user-student')?.profileImageId).toBeNull();
      expect((await fileOf(id)).status).toBe(404);
      expect((await del(ADMIN)).status).toBe(404);
    });
  });
});
