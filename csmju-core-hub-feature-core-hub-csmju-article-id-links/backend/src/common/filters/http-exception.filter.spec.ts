import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { TooManyRequestsException } from '../rate-limit/too-many-requests';
import {
  DEFAULT_RETRY_AFTER_SEC,
  HttpExceptionFilter,
} from './http-exception.filter';

function run(exception: unknown) {
  const headers: Record<string, string> = {};
  let status = 0;
  let body: { error: { code: string; statusCode: number } } | undefined;
  const response = {
    setHeader: (name: string, value: string) => (headers[name] = value),
    getHeader: (name: string) => headers[name],
    status: (code: number) => {
      status = code;
      return response;
    },
    json: (payload: typeof body) => (body = payload),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/api/v1/auth/mju/callback' }),
    }),
  } as unknown as ArgumentsHost;

  new HttpExceptionFilter().catch(exception, host);
  return { status, headers, body: body! };
}

describe('HttpExceptionFilter · error codes (error-codes.json)', () => {
  it('reports 503 as SERVICE_UNAVAILABLE with Retry-After in seconds', () => {
    const { status, headers, body } = run(
      new ServiceUnavailableException('MJU SSO is not configured'),
    );

    expect(status).toBe(503);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(headers['Retry-After']).toBe(String(DEFAULT_RETRY_AFTER_SEC));
  });

  it('keeps other 5xx as INTERNAL_ERROR without Retry-After', () => {
    const { body, headers } = run(new InternalServerErrorException());
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(headers['Retry-After']).toBeUndefined();

    expect(run(new Error('bug')).body.error.code).toBe('INTERNAL_ERROR');
  });

  it('still sends the 429 Retry-After it was given', () => {
    const { body, headers } = run(new TooManyRequestsException(7));
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(headers['Retry-After']).toBe('7');
  });

  it('reports a message array as VALIDATION_ERROR', () => {
    expect(
      run(new BadRequestException(['username nobody does not exist'])).body
        .error.code,
    ).toBe('VALIDATION_ERROR');
  });
});
