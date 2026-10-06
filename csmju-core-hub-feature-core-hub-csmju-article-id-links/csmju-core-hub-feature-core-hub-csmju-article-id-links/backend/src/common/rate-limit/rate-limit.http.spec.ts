import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import configuration, { type TrustProxy } from '../../config/configuration';
import { HttpExceptionFilter } from '../filters/http-exception.filter';
import { RateLimit, SkipRateLimit } from './rate-limit.decorator';
import { RateLimitModule } from './rate-limit.module';

/** Stands in for JwtAuthGuard: `x-test-user` becomes request.user. */
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user?: { id: string };
    }>();
    const id = req.headers['x-test-user'];
    if (id) req.user = { id };
    return true;
  }
}

@Controller()
class ProbeController {
  @Get('open')
  open() {
    return { ok: true };
  }

  @UseGuards(FakeAuthGuard)
  @Get('me')
  me() {
    return { ok: true };
  }

  @RateLimit('login')
  @Post('login')
  login() {
    return { ok: true };
  }

  @SkipRateLimit()
  @Get('health')
  health() {
    return { ok: true };
  }
}

/**
 * Both rate-limit layers, the route ceiling and the 429 envelope, through the
 * real Nest pipeline and Express's trust proxy - the parts a unit test of one
 * class cannot show fit together.
 */
async function boot(
  env: Record<string, string>,
): Promise<NestExpressApplication> {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        RateLimitModule,
      ],
      controllers: [ProbeController],
      providers: [FakeAuthGuard],
    }).compile();

    const app = moduleRef.createNestApplication<NestExpressApplication>();
    const trustProxy = app
      .get(ConfigService)
      .get<TrustProxy>('app.trustProxy', false);
    if (trustProxy !== false) app.set('trust proxy', trustProxy);
    app.useGlobalFilters(new HttpExceptionFilter());
    // Listen once, for real. Handed a server that is not listening, supertest
    // starts a fresh ephemeral one for every request, and 50 of those opened
    // at once reset connections on the CI runner (read ECONNRESET).
    await app.listen(0, '127.0.0.1');
    return app;
  } finally {
    process.env = previous;
  }
}

async function fire(count: number, send: () => request.Test) {
  const statuses: number[] = [];
  for (let sent = 0; sent < count; sent += 50) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(50, count - sent) }, send),
    );
    statuses.push(...batch.map((r) => r.status));
  }
  return statuses;
}

const tally = (statuses: number[]) =>
  statuses.reduce<Record<number, number>>(
    (acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }),
    {},
  );

describe('rate limiting over HTTP', () => {
  describe('with the shipped limits behind a trusted proxy', () => {
    let app: NestExpressApplication;
    const from = (ip: string) => (method: 'get' | 'post', path: string) =>
      request(app.getHttpServer())[method](path).set('X-Forwarded-For', ip);

    beforeAll(async () => {
      app = await boot({ TRUST_PROXY: 'loopback, uniquelocal' });
    });

    afterAll(() => app.close());

    it('lets one address make 600 requests in 10 s, then answers 429 in the standard envelope', async () => {
      const lab = from('203.0.113.10');
      expect(tally(await fire(600, () => lab('get', '/open')))).toEqual({
        200: 600,
      });

      const over = await lab('get', '/open');
      expect(over.status).toBe(429);
      expect(over.body).toMatchObject({
        success: false,
        error: { code: 'TOO_MANY_REQUESTS', statusCode: 429 },
      });
      const retryAfter = Number(over.headers['retry-after']);
      expect(Number.isInteger(retryAfter) && retryAfter >= 1).toBe(true);

      // Health is never throttled, and another address has its own budget.
      expect(tally(await fire(20, () => lab('get', '/health')))).toEqual({
        200: 20,
      });
      expect((await from('203.0.113.11')('get', '/open')).status).toBe(200);
    });

    it('stops one user at 100 requests in 10 s while another on the same address goes on', async () => {
      const office = from('203.0.113.20');
      const as = (user: string) => () =>
        office('get', '/me').set('x-test-user', user);

      expect(tally(await fire(100, as('user-alice')))).toEqual({ 200: 100 });

      const over = await as('user-alice')();
      expect(over.status).toBe(429);
      expect(over.body).toMatchObject({
        error: { code: 'TOO_MANY_REQUESTS' },
      });
      expect(Number(over.headers['retry-after'])).toBeGreaterThanOrEqual(1);

      expect((await as('user-bob')()).status).toBe(200);
    });

    it('holds login to 60 per minute per address on top of the global ceiling', async () => {
      const client = from('203.0.113.30');
      expect(tally(await fire(60, () => client('post', '/login')))).toEqual({
        201: 60,
      });
      expect((await client('post', '/login')).status).toBe(429);
      // The global ceiling is untouched by that: other routes still pass.
      expect((await client('get', '/open')).status).toBe(200);
    });

    it('takes the address the proxy appended, not the one the caller put on the left', async () => {
      // "<forged>, <real>": Cloudflare appends the real address on the right.
      const send = (forged: string) =>
        request(app.getHttpServer())
          .post('/login')
          .set('X-Forwarded-For', `${forged}, 203.0.113.40`);

      for (let i = 0; i < 60; i += 1) await send(`10.0.0.${i}`);
      expect((await send('10.9.9.9')).status).toBe(429);
    });
  });

  describe('with TRUST_PROXY unset', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      app = await boot({ TRUST_PROXY: '', RATE_LIMIT_LOGIN_LIMIT: '3' });
    });

    afterAll(() => app.close());

    it('ignores X-Forwarded-For, so a caller cannot pick a fresh bucket', async () => {
      const send = (ip: string) =>
        request(app.getHttpServer()).post('/login').set('X-Forwarded-For', ip);

      for (let i = 0; i < 3; i += 1) {
        expect((await send(`192.0.2.${i}`)).status).toBe(201);
      }
      expect((await send('192.0.2.99')).status).toBe(429);
    });
  });
});
