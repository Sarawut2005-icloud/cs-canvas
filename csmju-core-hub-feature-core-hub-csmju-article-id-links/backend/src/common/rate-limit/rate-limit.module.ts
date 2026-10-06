import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitStore } from './rate-limit.store';
import { UserRateLimitInterceptor } from './user-rate-limit.interceptor';

/**
 * rate limit 2 ชั้นของ Core Hub (SSO_FIX_HANDOFF 5.9)
 *
 * ลงทะเบียนเป็น global จึงมีผลกับทุก endpoint โดยไม่ต้องไล่ติดทีละตัว
 * endpoint ที่ต้องการเพดานเฉพาะหรือขอยกเว้น ค่อยติด @RateLimit / @SkipRateLimit
 *
 * RateLimitStore เป็น @Global เพื่อให้ AuthService ใช้ตัวนับเดียวกันนับรหัสผิดต่ออีเมล
 */
@Global()
@Module({
  providers: [
    RateLimitStore,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: UserRateLimitInterceptor },
  ],
  exports: [RateLimitStore],
})
export class RateLimitModule {}
