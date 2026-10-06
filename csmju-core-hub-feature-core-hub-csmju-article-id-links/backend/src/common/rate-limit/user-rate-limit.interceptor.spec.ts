import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';

import { RateLimitStore } from './rate-limit.store';
import { TooManyRequestsException } from './too-many-requests';
import { UserRateLimitInterceptor } from './user-rate-limit.interceptor';

const WINDOWS = [
  { limit: 100, windowSec: 10 },
  { limit: 600, windowSec: 60 },
];

function contextFor(user?: { id: string }, skip = false): ExecutionContext {
  const handler = () => undefined;
  if (skip) Reflect.defineMetadata('rate_limit_skip', true, handler);
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user, method: 'GET', path: '/api/v1/auth/me' }),
    }),
  } as unknown as ExecutionContext;
}

const next: CallHandler = { handle: () => of('ok') };

describe('UserRateLimitInterceptor', () => {
  let store: RateLimitStore;
  let interceptor: UserRateLimitInterceptor;

  beforeEach(() => {
    store = new RateLimitStore();
    const config = { get: () => WINDOWS } as unknown as ConfigService;
    interceptor = new UserRateLimitInterceptor(new Reflector(), store, config);
  });

  afterEach(() => store.onModuleDestroy());

  const call = (context: ExecutionContext) =>
    lastValueFrom(interceptor.intercept(context, next));

  it('does not count a request without request.user', async () => {
    for (let i = 0; i < 1000; i += 1) {
      await expect(call(contextFor())).resolves.toBe('ok');
    }
  });

  it('answers the 101st request in 10 s with 429 and a Retry-After', async () => {
    const alice = contextFor({ id: 'user-alice' });
    for (let i = 0; i < 100; i += 1) {
      await expect(call(alice)).resolves.toBe('ok');
    }

    let thrown: unknown;
    try {
      interceptor.intercept(alice, next);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TooManyRequestsException);
    expect((thrown as TooManyRequestsException).getStatus()).toBe(429);
    expect(
      (thrown as TooManyRequestsException).retryAfterSec,
    ).toBeGreaterThanOrEqual(1);
  });

  it('does not hold one user against another', async () => {
    const alice = contextFor({ id: 'user-alice' });
    for (let i = 0; i < 100; i += 1) await call(alice);
    expect(() => interceptor.intercept(alice, next)).toThrow(
      TooManyRequestsException,
    );

    await expect(call(contextFor({ id: 'user-bob' }))).resolves.toBe('ok');
  });

  it('leaves @SkipRateLimit endpoints alone', async () => {
    const skipped = contextFor({ id: 'user-alice' }, true);
    for (let i = 0; i < 500; i += 1) {
      await expect(call(skipped)).resolves.toBe('ok');
    }
  });
});
