import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';

import type { RateWindow } from '../../config/configuration';
import { RATE_LIMIT_SKIP_KEY } from './rate-limit.decorator';
import { RateLimitStore } from './rate-limit.store';
import { tooManyRequests } from './too-many-requests';

/**
 * rate limit ชั้น 2 — นับต่อผู้ใช้ที่ login แล้ว (`user:<sub>`)
 *
 * ต้องเป็น interceptor ไม่ใช่ guard เพราะ JwtAuthGuard ติดไว้ราย controller
 * ตอนที่ global guard ทำงาน `request.user` จึงยังไม่มี ส่วน interceptor
 * ทำงานหลัง guard ทุกตัวแล้ว
 *
 * endpoint ที่ไม่ต้อง login (ไม่มี `request.user`) ผ่านไปเลย ให้ชั้น 1 ดูแล
 * การนับต่อผู้ใช้คือสิ่งที่ทำให้คนในห้องแล็บเดียวกันไม่โดนบล็อกเพราะเพื่อน
 */
@Injectable()
export class UserRateLimitInterceptor implements NestInterceptor {
  private readonly windows: RateWindow[];

  constructor(
    private readonly reflector: Reflector,
    private readonly store: RateLimitStore,
    config: ConfigService,
  ) {
    this.windows = config.get<RateWindow[]>('rateLimit.user') ?? [];
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const skip = this.reflector.getAllAndOverride<boolean>(
      RATE_LIMIT_SKIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { id?: string } }>();
    const userId = request.user?.id;

    if (skip || !userId) {
      return next.handle();
    }

    const wait = this.store.consume(`user:${userId}`, this.windows);
    if (wait !== null) {
      tooManyRequests(request, wait, 'user', `user=${userId}`);
    }

    return next.handle();
  }
}
