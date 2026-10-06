import { Request } from 'express';

/**
 * IP ของผู้เรียกที่ใช้เป็นกุญแจนับ rate limit
 *
 * ใช้ `request.ip` ที่ Express คำนวณจากค่า `trust proxy` เท่านั้น (ตั้งจาก
 * TRUST_PROXY ใน main.ts) ห้ามอ่าน CF-Connecting-IP หรือ X-Forwarded-For เอง
 * เพราะผู้เรียกใส่ค่าอะไรมาก็ได้ แล้วเลือก bucket ของตัวเองได้ทุกครั้ง
 *
 *   TRUST_PROXY ว่าง                  request.ip = IP ที่ต่อเข้ามาตรง ๆ
 *   TRUST_PROXY=loopback, uniquelocal  Express ข้าม IP ภายใน (cloudflared,
 *                                      core-hub-web) แล้วเอา IP สาธารณะตัว
 *                                      ขวาสุดที่ Cloudflare ต่อท้ายไว้ ค่าที่
 *                                      ผู้เรียกใส่มาเองอยู่ทางซ้ายและถูกเมิน
 */
export function getClientIp(request: Request): string {
  return typeof request.ip === 'string' && request.ip.length > 0
    ? request.ip
    : 'unknown';
}
