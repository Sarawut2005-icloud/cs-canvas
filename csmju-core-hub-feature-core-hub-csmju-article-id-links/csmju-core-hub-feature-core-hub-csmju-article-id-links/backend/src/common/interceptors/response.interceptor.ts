import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';
import { Paginated, PageMeta } from '../pagination/paginated';

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PageMeta;
  requestId: string;
  timestamp: string;
}

/**
 * Endpoints that must return their raw body instead of the Core Hub envelope.
 *
 * The JWKS document is a public interoperability contract (RFC 7517): every
 * standard client library (jose, jwks-rsa, Spring Security, PyJWKClient, ...)
 * expects `{ "keys": [...] }` at the top level, so it must not be wrapped.
 */
const RAW_RESPONSE_PATH_SUFFIXES = ['/.well-known/jwks.json'];

function isRawResponsePath(path: string): boolean {
  return RAW_RESPONSE_PATH_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | ApiResponse<unknown[]> | T
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | ApiResponse<unknown[]> | T> {
    const request = _context.switchToHttp().getRequest<Request>();
    const requestId = request.headers['x-request-id'];

    if (isRawResponsePath(request.path)) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: T) => {
        // Files (images for `<img src>`, announcement covers) go out as raw bytes.
        if (data instanceof StreamableFile) {
          return data;
        }

        const envelope = {
          success: true as const,
          requestId: requestId?.toString() ?? '',
          timestamp: new Date().toISOString(),
        };

        // ผลลัพธ์แบบแบ่งหน้า: data เป็นรายการ และ meta อยู่ชั้นบน (api-conventions)
        if (data instanceof Paginated) {
          return {
            ...envelope,
            data: data.items as T,
            meta: data.meta,
          };
        }

        return { ...envelope, data };
      }),
    );
  }
}
