import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';
import { Paginated } from '../pagination/paginated';

function contextFor(path: string): ExecutionContext {
  const request = { path, headers: { 'x-request-id': 'req-1' } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function handlerOf(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor<unknown>();

  it('ค่าทั่วไป: ได้ envelope เดิม ไม่มี meta', async () => {
    const out = (await lastValueFrom(
      interceptor.intercept(contextFor('/api/v1/users'), handlerOf({ a: 1 })),
    )) as Record<string, unknown>;
    expect(out.success).toBe(true);
    expect(out.data).toEqual({ a: 1 });
    expect(out.requestId).toBe('req-1');
    expect(typeof out.timestamp).toBe('string');
    expect(out).not.toHaveProperty('meta');
  });

  it('Paginated: data เป็นรายการ และ meta อยู่ชั้นบน', async () => {
    const meta = { total: 6, page: 1, limit: 2, totalPages: 3 };
    const out = (await lastValueFrom(
      interceptor.intercept(
        contextFor('/api/v1/rooms'),
        handlerOf(new Paginated([{ id: 'a' }], meta)),
      ),
    )) as Record<string, unknown>;
    expect(out.data).toEqual([{ id: 'a' }]);
    expect(out.meta).toEqual(meta);
  });

  it('JWKS ไม่ถูกห่อ', async () => {
    const jwks = { keys: [] };
    const out = await lastValueFrom(
      interceptor.intercept(
        contextFor('/api/v1/.well-known/jwks.json'),
        handlerOf(jwks),
      ),
    );
    expect(out).toBe(jwks);
  });
});
