/** ค่าที่ส่งให้ `app.set('trust proxy', …)` ของ Express หรือ false = ไม่ตั้ง */
export type TrustProxy = false | number | string;

/** หน้าต่างเวลาหนึ่งอัน: ยอมได้ `limit` ครั้งภายใน `windowSec` วินาที */
export interface RateWindow {
  limit: number;
  windowSec: number;
}

/**
 * TRUST_PROXY: ว่างหรือ `false` = ไม่ตั้ง · ตัวเลขล้วน = จำนวน hop ·
 * ค่าอื่นส่งให้ Express ตามที่เขียน เช่น `loopback, uniquelocal`
 */
export function parseTrustProxy(value: string | undefined): TrustProxy {
  const raw = value?.trim() ?? '';

  if (raw === '' || raw.toLowerCase() === 'false') {
    return false;
  }

  if (/^\d+$/.test(raw)) {
    const hops = Number(raw);
    return hops === 0 ? false : hops;
  }

  return raw;
}

/** จำนวนเต็มบวกจาก env หรือค่า default — ค่าที่เพี้ยนจะไม่ปิดเพดานทิ้ง */
function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function rateWindow(prefix: string, defaults: RateWindow): RateWindow {
  return {
    limit: positive(process.env[`${prefix}_LIMIT`], defaults.limit),
    windowSec: positive(
      process.env[`${prefix}_WINDOW_SEC`],
      defaults.windowSec,
    ),
  };
}

export default () => ({
  app: {
    name: process.env.APP_NAME || 'core-api',
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    // Public origin of this API, e.g. https://core.example.ac.th — used to
    // build absolute image URLs. Empty means "take it from the request".
    publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    // Pre-launch only: lets a production API register and redirect to
    // http://localhost callbacks, so teams can run their subsystem on their
    // own machine against the real server. Only the exact string `true`
    // turns it on; turning it off closes registration and SSO to those
    // callbacks at once.
    allowLocalhostCallbacks: process.env.ALLOW_LOCALHOST_CALLBACKS === 'true',
  },

  database: {
    url: process.env.DATABASE_URL || '',
  },

  uploads: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    // รูปที่ลบแล้วจะถูกลบไฟล์และแถวทิ้งถาวรเมื่อครบกี่วัน (งานรันทุกคืนตี 3)
    purgeAfterDays: positive(process.env.IMAGE_PURGE_AFTER_DAYS, 30),
  },
  jwt: {
    secret: process.env.JWT_SECRET,

    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',

    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',

    privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH ?? 'keys/jwt-private.pem',

    publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH ?? 'keys/jwt-public.pem',
  },

  /**
   * rate limit (SSO_FIX_HANDOFF 5.9) — ตั้งผ่าน env ได้ทุกตัว
   *
   * ชั้น 1 นับต่อ IP ทั้งแอป ตั้งหลวมเพราะห้องแล็บ 50 คนออกเน็ตด้วย IP เดียว
   * ชั้น 2 นับต่อผู้ใช้ที่ login แล้ว ซึ่งแม่นกว่าเมื่อหลายคนใช้ IP เดียวกัน
   */
  rateLimit: {
    ip: [
      rateWindow('RATE_LIMIT_IP_BURST', { limit: 600, windowSec: 10 }),
      rateWindow('RATE_LIMIT_IP_SUSTAINED', { limit: 3000, windowSec: 60 }),
    ],
    user: [
      rateWindow('RATE_LIMIT_USER_BURST', { limit: 100, windowSec: 10 }),
      rateWindow('RATE_LIMIT_USER_SUSTAINED', { limit: 600, windowSec: 60 }),
    ],
    /** เพดานเฉพาะ route นับต่อ IP เพิ่มจากชั้น 1 — ชื่อตรงกับที่ใส่ใน @RateLimit() */
    routes: {
      // bcrypt ใช้ CPU ~100 ms ต่อครั้ง 60 ครั้ง/นาที = ~10% ของหนึ่งคอร์ต่อ IP
      // และพอให้ห้องแล็บ 50 คน login พร้อมกันได้
      login: rateWindow('RATE_LIMIT_LOGIN', { limit: 60, windowSec: 60 }),
      refresh: rateWindow('RATE_LIMIT_REFRESH', { limit: 120, windowSec: 60 }),
      // sharp ใช้ CPU ~0.5 วินาทีต่อรูปใหญ่ 60 ครั้ง/นาที = ~50% ของหนึ่งคอร์ต่อ IP
      // และพอให้ห้องแล็บ 50 คนอัปรูปโปรไฟล์พร้อมกันได้
      imageUpload: rateWindow('RATE_LIMIT_IMAGE_UPLOAD', {
        limit: 60,
        windowSec: 60,
      }),
      // bcrypt สองถึงสามรอบต่อคำขอ และคนปกติเปลี่ยนรหัสไม่กี่ครั้ง
      changePassword: rateWindow('RATE_LIMIT_CHANGE_PASSWORD', {
        limit: 10,
        windowSec: 60,
      }),
      // แลก code ของ MJU SSO หนึ่งครั้ง = เรียก sso.mju.ac.th หนึ่งครั้ง ตั้งเท่า login
      // เพราะห้องแล็บ 50 คนที่ออกเน็ต IP เดียวอาจกดเข้าด้วย MJU SSO พร้อมกัน
      mjuCallback: rateWindow('RATE_LIMIT_MJU_CALLBACK', {
        limit: 60,
        windowSec: 60,
      }),
    } as Record<string, RateWindow>,
    /** ใส่รหัสผิดกี่ครั้งต่ออีเมลภายในกี่วินาที แล้วตอบ 429 จนครบเวลา */
    loginLockout: rateWindow('LOGIN_LOCKOUT', {
      limit: 10,
      windowSec: 15 * 60,
    }),
  },

  // MJU SSO (sso.mju.ac.th). Disabled unless MJU_CLIENT_ID is set.
  mju: {
    clientId: process.env.MJU_CLIENT_ID ?? '',
    tokenUrl:
      process.env.MJU_SSO_TOKEN_URL ?? 'https://sso.mju.ac.th/token.aspx',
    // Keyed hash secret for citizenID → mju_subject. Required when enabled.
    subjectSecret: process.env.MJU_SUBJECT_SECRET ?? '',
  },

  // Versions a subsystem may declare (standardsVersion) — the tags of
  // csmju2030-standards, read by StandardsVersionsService.
  standards: {
    /** GitHub "list tags" URL; empty = never fetch, use the fallback only. */
    tagsUrl: process.env.STANDARDS_TAGS_URL?.trim() ?? '',
    /** Optional bearer token, for when the standards repo becomes private. */
    tagsToken: process.env.STANDARDS_TAGS_TOKEN?.trim() ?? '',
    /** Used until the first fetch succeeds, e.g. "1.7.2,1.7.1,1.0.6". */
    fallbackVersions: (process.env.STANDARDS_VERSIONS_FALLBACK ?? '')
      .split(',')
      .map((version) => version.trim().replace(/^v/, ''))
      .filter(Boolean),
  },
});
