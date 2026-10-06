import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';

import { LoggingInterceptor } from './logging.interceptor';

function context(originalUrl: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', originalUrl, headers: {} }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;
}

describe('LoggingInterceptor', () => {
  afterEach(() => jest.restoreAllMocks());

  it('logs the path without the query string (no ?q=<name>)', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const next: CallHandler = { handle: () => of({}) };

    await lastValueFrom(
      new LoggingInterceptor().intercept(
        context('/api/v1/people?q=Somchai&page=2'),
        next,
      ),
    );

    const line = String(log.mock.calls[0][0]);
    expect(line).toMatch(/^GET \/api\/v1\/people \|/);
    expect(line).not.toContain('Somchai');
    expect(line).not.toContain('?');
  });

  it('does the same on errors', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const next: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await expect(
      lastValueFrom(
        new LoggingInterceptor().intercept(
          context('/api/v1/people?q=Somchai'),
          next,
        ),
      ),
    ).rejects.toThrow('boom');

    expect(String(error.mock.calls[0][0])).not.toContain('Somchai');
  });
});
