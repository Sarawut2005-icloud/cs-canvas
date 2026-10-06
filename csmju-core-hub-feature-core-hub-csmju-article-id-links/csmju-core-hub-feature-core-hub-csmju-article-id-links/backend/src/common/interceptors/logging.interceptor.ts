import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const method = request.method;
    // Path only: the query string can carry personal data, e.g. the name
    // typed into `GET /people?q=`.
    const url = request.originalUrl.split('?')[0];
    const requestId = request.headers['x-request-id']?.toString() ?? 'unknown';

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;

        this.logger.log(
          `${method} ${url} | ` +
            `status=${response.statusCode} | ` +
            `requestId=${requestId} | ` +
            `duration=${duration}ms`,
        );
      }),

      catchError((error: unknown) => {
        const duration = Date.now() - startTime;

        let statusCode = 500;

        if (error instanceof Error && 'getStatus' in error) {
          const getStatus = (
            error as Error & {
              getStatus?: () => unknown;
            }
          ).getStatus;

          if (typeof getStatus === 'function') {
            const result: unknown = getStatus.call(error);

            if (typeof result === 'number') {
              statusCode = result;
            }
          }
        }

        this.logger.error(
          `${method} ${url} | ` +
            `status=${statusCode} | ` +
            `requestId=${requestId} | ` +
            `duration=${duration}ms`,
        );

        return throwError(() => error);
      }),
    );
  }
}
