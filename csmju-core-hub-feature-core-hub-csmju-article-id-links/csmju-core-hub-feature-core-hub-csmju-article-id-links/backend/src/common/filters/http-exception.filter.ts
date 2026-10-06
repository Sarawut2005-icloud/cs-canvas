import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';

import { TooManyRequestsException } from '../rate-limit/too-many-requests';

/**
 * `error.code` values — the closed enum from
 * csmju2030-standards/contracts/error-codes.json (API-04).
 */
type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

/**
 * Seconds a client should wait after a 503 that did not say how long — e.g.
 * MJU SSO unreachable or not configured. The contract requires the header.
 */
export const DEFAULT_RETRY_AFTER_SEC = 30;

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  // Sent with a Retry-After header when thrown as TooManyRequestsException.
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  // A dependency is down for now (MJU SSO, …) — sent with Retry-After.
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

function errorCodeFor(status: number, isValidation: boolean): ErrorCode {
  if (status === 400 && isValidation) return 'VALIDATION_ERROR';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  if (status >= 500) return 'INTERNAL_ERROR';
  return CODE_BY_STATUS[status] ?? 'BAD_REQUEST';
}

/** body-parser's `PayloadTooLargeError` (it is not a Nest HttpException). */
function isPayloadTooLarge(exception: unknown): boolean {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'type' in exception &&
    (exception as { type?: unknown }).type === 'entity.too.large'
  );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: string[] | undefined;

    if (exception instanceof TooManyRequestsException) {
      // Whole seconds, at least 1 - clients back off by this.
      response.setHeader('Retry-After', String(exception.retryAfterSec));
    }

    if (isPayloadTooLarge(exception)) {
      // body-parser rejects an oversized body before any handler runs. The
      // closed error-code list has no 413, so the client sees a plain 400.
      status = HttpStatus.BAD_REQUEST;
      message = 'Request body is too large (max 2 MB)';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();

      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const errorResponse = exceptionResponse as {
          message?: string | string[];
        };

        if (Array.isArray(errorResponse.message)) {
          // ValidationPipe reports one entry per failed constraint.
          details = errorResponse.message;
          message = errorResponse.message.join(', ');
        } else {
          message = errorResponse.message ?? message;
        }
      }
    }

    if (
      status === HttpStatus.SERVICE_UNAVAILABLE &&
      !response.getHeader('Retry-After')
    ) {
      response.setHeader('Retry-After', String(DEFAULT_RETRY_AFTER_SEC));
    }

    response.status(status).json({
      success: false,
      error: {
        code: errorCodeFor(status, details !== undefined),
        statusCode: status,
        message,
        ...(details ? { details } : {}),
      },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
