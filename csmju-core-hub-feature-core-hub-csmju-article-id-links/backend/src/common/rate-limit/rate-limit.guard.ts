import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import type { RateWindow } from '../../config/configuration';
import { getClientIp } from './client-ip';
import { RATE_LIMIT_KEY, RATE_LIMIT_SKIP_KEY } from './rate-limit.decorator';
import { RateLimitStore } from './rate-limit.store';
import { tooManyRequests } from './too-many-requests';

/**
 * rate limit ชั้น 1 — นับต่อ IP (global guard)
 *
 * ทำงานก่อน JwtAuthGuard ของทุก controller จึงกันการยิงถล่มได้ก่อนเสีย
 * งานตรวจลายเซ็น token หรือ bcrypt ตั้งหลวม (600 ครั้ง/10 วินาที และ
 * 3,000 ครั้ง/นาที) เพราะทั้งห้องแล็บออกเน็ตด้วย IP เดียวกัน การนับที่
 * แม่นกว่าอยู่ในชั้น 2 (UserRateLimitInterceptor) ซึ่งนับต่อผู้ใช้
 *
 * endpoint ที่ติด @RateLimit('<ชื่อ>') โดนเพดานเฉพาะของตัวเองเพิ่มอีกชั้น
 * นับต่อ IP เช่นกัน เช่น login ที่ต้องกัน bcrypt ถูกใช้เป็นเครื่องเผา CPU
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly ipWindows: RateWindow[];

  private readonly routeWindows: Record<string, RateWindow>;

  constructor(
    private readonly reflector: Reflector,
    private readonly store: RateLimitStore,
    config: ConfigService,
  ) {
    this.ipWindows = config.get<RateWindow[]>('rateLimit.ip') ?? [];
    this.routeWindows =
      config.get<Record<string, RateWindow>>('rateLimit.routes') ?? {};
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const targets = [context.getHandler(), context.getClass()];
    if (
      this.reflector.getAllAndOverride<boolean>(RATE_LIMIT_SKIP_KEY, targets)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ip = getClientIp(request);

    const wait = this.store.consume(`ip:${ip}`, this.ipWindows);
    if (wait !== null) {
      tooManyRequests(request, wait, 'ip', `ip=${ip}`);
    }

    const route = this.reflector.getAllAndOverride<string>(
      RATE_LIMIT_KEY,
      targets,
    );
    const routeWindow = route ? this.routeWindows[route] : undefined;
    if (route && routeWindow) {
      const routeWait = this.store.consume(`route:${route}:${ip}`, [
        routeWindow,
      ]);
      if (routeWait !== null) {
        tooManyRequests(request, routeWait, `route:${route}`, `ip=${ip}`);
      }
    }

    return true;
  }
}
