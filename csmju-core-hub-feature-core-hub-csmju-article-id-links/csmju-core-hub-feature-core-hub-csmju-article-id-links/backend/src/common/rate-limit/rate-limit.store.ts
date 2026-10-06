import { Injectable, OnModuleDestroy } from '@nestjs/common';

import type { RateWindow } from '../../config/configuration';

/** ล้างกุญแจที่ไม่มีคำขอมาแล้วนานทุก ๆ ช่วงนี้ กัน Map โตไม่หยุด */
const SWEEP_INTERVAL_MS = 60_000;

interface Bucket {
  windowMs: number;
  /** เวลาที่คำขอเข้ามา เรียงจากเก่าไปใหม่ */
  times: number[];
}

/**
 * ตัวนับ sliding window ในหน่วยความจำ ที่ทุกชั้นของ rate limit ใช้ร่วมกัน
 * (ชั้น IP · ชั้นผู้ใช้ · เพดานต่อ route · ตัวนับรหัสผิดต่ออีเมล)
 *
 * ทำไมเขียนเองแทนที่จะใช้ @nestjs/throttler
 * ------------------------------------------
 * กฎ ARC-02/03 ของ csmju2030-standards ตรวจ package.json เทียบกับรายชื่อ
 * dependency ที่อนุญาต (scripts/lib/allowed-deps.json) ซึ่งไม่มี
 * @nestjs/throttler และ express-rate-limit ก็ใช้ไม่ได้เพราะ express อยู่ใน
 * forbidden_everywhere
 *
 * ข้อจำกัดที่ยอมรับไว้
 * --------------------
 * ตัวนับอยู่ใน process — restart แล้วรีเซ็ต และถ้าขยายเป็นหลาย instance
 * แต่ละตัวจะนับแยกกัน (ต้องย้ายไป Redis ถ้าถึงจุดนั้น) ตอนนี้ไม่กระทบเพราะ
 * dev server รัน instance เดียว
 */
@Injectable()
export class RateLimitStore implements OnModuleDestroy {
  private readonly buckets = new Map<string, Bucket>();

  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // อย่าให้ตัวจับเวลากั้นไม่ให้ process ปิดตัวตอน shutdown
    this.sweeper.unref?.();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
    this.buckets.clear();
  }

  /**
   * นับคำขอหนึ่งครั้งกับทุกหน้าต่าง หรือปฏิเสธ
   *
   * ทุกหน้าต่างต้องยังมีที่ว่าง และจะนับเพิ่มก็ต่อเมื่อไม่มีหน้าต่างไหนเต็ม
   * คำขอที่หน้าต่างสั้นปฏิเสธจึงไม่กินโควตาของหน้าต่างยาวไปด้วย
   *
   * @returns วินาทีที่ต้องรอเมื่อถูกปฏิเสธ หรือ null เมื่อผ่าน
   */
  consume(key: string, windows: readonly RateWindow[]): number | null {
    const wait = this.retryAfter(key, windows);
    if (wait !== null) {
      return wait;
    }
    this.charge(key, windows);
    return null;
  }

  /** วินาทีที่ต้องรอถ้ามีหน้าต่างไหนเต็มแล้ว โดยไม่นับเพิ่ม หรือ null */
  retryAfter(key: string, windows: readonly RateWindow[]): number | null {
    const now = Date.now();
    let longest: number | null = null;

    for (const window of windows) {
      const windowMs = window.windowSec * 1000;
      const bucket = this.bucketFor(this.keyOf(key, window), windowMs, now);

      if (bucket.times.length >= window.limit) {
        // คำขอที่เก่าที่สุดจะหลุดหน้าต่างเมื่อไหร่ ก็รออีกเท่านั้น
        const wait = Math.max(
          1,
          Math.ceil((bucket.times[0] + windowMs - now) / 1000),
        );
        longest = longest === null ? wait : Math.max(longest, wait);
      }
    }

    return longest;
  }

  /** นับเพิ่มหนึ่งครั้งกับทุกหน้าต่าง โดยไม่ตรวจเพดาน */
  charge(key: string, windows: readonly RateWindow[]): void {
    const now = Date.now();
    for (const window of windows) {
      const windowMs = window.windowSec * 1000;
      this.bucketFor(this.keyOf(key, window), windowMs, now).times.push(now);
    }
  }

  /** ลบตัวนับของกุญแจนี้ทุกหน้าต่าง เช่น ล้างตัวนับรหัสผิดเมื่อ login สำเร็จ */
  clear(key: string, windows: readonly RateWindow[]): void {
    for (const window of windows) {
      this.buckets.delete(this.keyOf(key, window));
    }
  }

  private keyOf(key: string, window: RateWindow): string {
    return `${key}|${window.limit}/${window.windowSec}`;
  }

  private bucketFor(key: string, windowMs: number, now: number): Bucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { windowMs, times: [] };
      this.buckets.set(key, bucket);
    }

    const cutoff = now - windowMs;
    let stale = 0;
    while (stale < bucket.times.length && bucket.times[stale] <= cutoff) {
      stale += 1;
    }
    if (stale > 0) {
      bucket.times.splice(0, stale);
    }

    return bucket;
  }

  /**
   * ล้างกุญแจที่คำขอล่าสุดหลุดหน้าต่าง "ของตัวเอง" ไปแล้ว
   * เก็บ windowMs ไว้กับแต่ละ bucket เพราะแต่ละหน้าต่างยาวไม่เท่ากัน ถ้ากวาด
   * โดยยึดหน้าต่างเดียว ตัวนับที่ยังใช้งานอยู่ของหน้าต่างยาวจะถูกลบกลางคัน
   */
  private sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      const last = bucket.times[bucket.times.length - 1];
      if (last === undefined || now - last > bucket.windowMs) {
        this.buckets.delete(key);
      }
    }
  }
}
