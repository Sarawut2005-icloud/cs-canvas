import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request } from 'express';

const logger = new Logger('RateLimit');

/**
 * 429 ที่พกจำนวนวินาทีที่ต้องรอไปด้วย HttpExceptionFilter อ่านค่านี้ไปตั้ง
 * header `Retry-After` และแปลงเป็น envelope `error.code = "TOO_MANY_REQUESTS"`
 * ทุกทางที่ตอบ 429 จึงได้ header ครบจากที่เดียว รวมถึงจาก service ที่แตะ
 * response เองไม่ได้ เช่น ตัวนับรหัสผิดใน AuthService
 */
export class TooManyRequestsException extends HttpException {
  constructor(
    readonly retryAfterSec: number,
    message = 'Too many requests, please slow down',
  ) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * log แล้วโยน TooManyRequestsException — ใช้โดย guard และ interceptor
 * log แค่ path ไม่เอา query string เพราะบาง route มีข้อมูลที่ไม่ควรลง log
 */
export function tooManyRequests(
  request: Request,
  retryAfterSec: number,
  scope: string,
  who: string,
): never {
  logger.warn(
    `rate limit exceeded | scope=${scope} ${who} ` +
      `path=${request.method} ${request.path} retryAfter=${retryAfterSec}s`,
  );

  throw new TooManyRequestsException(retryAfterSec);
}
