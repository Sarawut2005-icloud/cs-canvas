import configuration, { parseTrustProxy } from './configuration';

describe('configuration', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  describe('app.allowLocalhostCallbacks', () => {
    it('is on only for the exact string "true"', () => {
      process.env.ALLOW_LOCALHOST_CALLBACKS = 'true';
      expect(configuration().app.allowLocalhostCallbacks).toBe(true);
    });

    it.each(['1', 'yes', 'TRUE ', 'True', 'false', ''])(
      'is off for %p',
      (value) => {
        process.env.ALLOW_LOCALHOST_CALLBACKS = value;
        expect(configuration().app.allowLocalhostCallbacks).toBe(false);
      },
    );

    it('is off when unset', () => {
      delete process.env.ALLOW_LOCALHOST_CALLBACKS;
      expect(configuration().app.allowLocalhostCallbacks).toBe(false);
    });
  });

  describe('parseTrustProxy', () => {
    it.each([undefined, '', '   ', 'false', 'FALSE', '0'])(
      'leaves trust proxy unset for %p',
      (value) => {
        expect(parseTrustProxy(value)).toBe(false);
      },
    );

    it('reads a whole number as a hop count', () => {
      expect(parseTrustProxy('1')).toBe(1);
      expect(parseTrustProxy(' 2 ')).toBe(2);
    });

    it('passes anything else to Express as written', () => {
      expect(parseTrustProxy('loopback, uniquelocal')).toBe(
        'loopback, uniquelocal',
      );
    });

    it('is read from TRUST_PROXY', () => {
      process.env.TRUST_PROXY = 'loopback, uniquelocal';
      expect(configuration().app.trustProxy).toBe('loopback, uniquelocal');
      delete process.env.TRUST_PROXY;
      expect(configuration().app.trustProxy).toBe(false);
    });
  });

  describe('rateLimit', () => {
    it('ships the limits of SSO_FIX_HANDOFF 5.9', () => {
      for (const key of Object.keys(process.env)) {
        if (/^(RATE_LIMIT_|LOGIN_LOCKOUT_)/.test(key)) delete process.env[key];
      }

      expect(configuration().rateLimit).toEqual({
        ip: [
          { limit: 600, windowSec: 10 },
          { limit: 3000, windowSec: 60 },
        ],
        user: [
          { limit: 100, windowSec: 10 },
          { limit: 600, windowSec: 60 },
        ],
        routes: {
          login: { limit: 60, windowSec: 60 },
          refresh: { limit: 120, windowSec: 60 },
          imageUpload: { limit: 60, windowSec: 60 },
          changePassword: { limit: 10, windowSec: 60 },
          mjuCallback: { limit: 60, windowSec: 60 },
        },
        loginLockout: { limit: 10, windowSec: 900 },
      });
    });

    it('is tunable through env', () => {
      process.env.RATE_LIMIT_IP_BURST_LIMIT = '900';
      process.env.RATE_LIMIT_LOGIN_LIMIT = '30';
      process.env.LOGIN_LOCKOUT_WINDOW_SEC = '600';

      const { rateLimit } = configuration();
      expect(rateLimit.ip[0]).toEqual({ limit: 900, windowSec: 10 });
      expect(rateLimit.routes.login).toEqual({ limit: 30, windowSec: 60 });
      expect(rateLimit.loginLockout).toEqual({ limit: 10, windowSec: 600 });
    });

    it.each(['0', '-5', '1.5', 'unlimited'])(
      'ignores the nonsensical value %s instead of removing the ceiling',
      (value) => {
        process.env.RATE_LIMIT_USER_BURST_LIMIT = value;
        expect(configuration().rateLimit.user[0].limit).toBe(100);
      },
    );
  });

  describe('uploads.purgeAfterDays', () => {
    it('keeps deleted images for 30 days unless IMAGE_PURGE_AFTER_DAYS says otherwise', () => {
      delete process.env.IMAGE_PURGE_AFTER_DAYS;
      expect(configuration().uploads.purgeAfterDays).toBe(30);

      process.env.IMAGE_PURGE_AFTER_DAYS = '7';
      expect(configuration().uploads.purgeAfterDays).toBe(7);
    });

    // 0 would purge an image the moment it is deleted.
    it.each(['0', '-1', 'never'])('ignores %s', (value) => {
      process.env.IMAGE_PURGE_AFTER_DAYS = value;
      expect(configuration().uploads.purgeAfterDays).toBe(30);
    });
  });
});
