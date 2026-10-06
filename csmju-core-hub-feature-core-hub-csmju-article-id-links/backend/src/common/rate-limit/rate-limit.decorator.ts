import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit_route';
export const RATE_LIMIT_SKIP_KEY = 'rate_limit_skip';

/**
 * เพดานเฉพาะ endpoint นี้ นับแยกตาม IP ของผู้เรียก
 *
 * รับชื่อ ไม่ใช่ตัวเลข — ตัวเลขอยู่ใน `rateLimit.routes.<ชื่อ>` ของ
 * configuration ซึ่งตั้งผ่าน env ได้ ใช้เพิ่มจากเพดานรวมทั้งแอป ไม่ได้แทนที่
 * คำขอต้องผ่านทั้งสองชั้น
 *
 *   @RateLimit('login')
 */
export const RateLimit = (route: string) => SetMetadata(RATE_LIMIT_KEY, route);

/**
 * ยกเว้น endpoint นี้จาก rate limit ทุกชั้น
 *
 * ใช้กับ endpoint ที่ระบบอื่นต้องเรียกได้เสมอ ถ้าโดนบล็อกจะพังเป็นลูกโซ่
 * เช่น /health (Docker healthcheck + watchdog) และ JWKS (ระบบย่อยทุกตัว
 * ต้องดึงกุญแจมาตรวจลายเซ็น ถ้าดึงไม่ได้คือ token ใช้ไม่ได้ทั้งแพลตฟอร์ม)
 */
export const SkipRateLimit = () => SetMetadata(RATE_LIMIT_SKIP_KEY, true);
