import { RateLimitStore } from './rate-limit.store';

describe('RateLimitStore', () => {
  let store: RateLimitStore;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-27T00:00:00Z') });
    store = new RateLimitStore();
  });

  afterEach(() => {
    store.onModuleDestroy();
    jest.useRealTimers();
  });

  const burst = { limit: 3, windowSec: 10 };
  const sustained = { limit: 5, windowSec: 60 };

  it('lets requests through up to the limit, then answers with seconds to wait', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(store.consume('ip:a', [burst])).toBeNull();
    }
    expect(store.consume('ip:a', [burst])).toBe(10);
  });

  it('frees a slot once the oldest request leaves the window', () => {
    for (let i = 0; i < 3; i += 1) store.consume('ip:a', [burst]);

    jest.advanceTimersByTime(9_000);
    expect(store.consume('ip:a', [burst])).toBe(1);

    jest.advanceTimersByTime(1_001);
    expect(store.consume('ip:a', [burst])).toBeNull();
  });

  it('never answers less than one second', () => {
    for (let i = 0; i < 3; i += 1) store.consume('ip:a', [burst]);
    jest.advanceTimersByTime(9_999);
    expect(store.consume('ip:a', [burst])).toBe(1);
  });

  it('enforces every window and waits for the longest one', () => {
    // 5 requests spread so the burst window has room but sustained does not.
    for (let i = 0; i < 5; i += 1) {
      expect(store.consume('ip:a', [burst, sustained])).toBeNull();
      jest.advanceTimersByTime(11_000);
    }
    // 55 s after the first request: sustained frees up in 5 s.
    expect(store.consume('ip:a', [burst, sustained])).toBe(5);
  });

  it('does not charge a refused request to any window', () => {
    for (let i = 0; i < 3; i += 1) store.consume('ip:a', [burst, sustained]);
    for (let i = 0; i < 10; i += 1) store.consume('ip:a', [burst, sustained]);

    jest.advanceTimersByTime(10_001);
    // Had the refusals been counted, sustained (5/min) would be full already.
    expect(store.consume('ip:a', [burst, sustained])).toBeNull();
    expect(store.consume('ip:a', [burst, sustained])).toBeNull();
  });

  it('counts each key on its own', () => {
    for (let i = 0; i < 3; i += 1) store.consume('ip:a', [burst]);
    expect(store.consume('ip:a', [burst])).not.toBeNull();
    expect(store.consume('ip:b', [burst])).toBeNull();
  });

  it('checks without charging, and charges without checking', () => {
    const lockout = { limit: 2, windowSec: 900 };
    expect(store.retryAfter('login-failure:x', [lockout])).toBeNull();
    store.charge('login-failure:x', [lockout]);
    store.charge('login-failure:x', [lockout]);
    expect(store.retryAfter('login-failure:x', [lockout])).toBe(900);
    // Still 900: retryAfter itself never adds to the count.
    expect(store.retryAfter('login-failure:x', [lockout])).toBe(900);
  });

  it('clears a key', () => {
    const lockout = { limit: 1, windowSec: 900 };
    store.charge('login-failure:x', [lockout]);
    store.clear('login-failure:x', [lockout]);
    expect(store.retryAfter('login-failure:x', [lockout])).toBeNull();
  });

  it('keeps a long window counting when a short one with the same key sweeps', () => {
    const long = { limit: 2, windowSec: 600 };
    store.consume('k', [burst, long]);
    store.consume('k', [burst, long]);

    // Two sweeps (every 60 s) pass: the burst bucket is dropped, the long one must stay.
    jest.advanceTimersByTime(125_000);
    expect(store.consume('k', [burst, long])).toBeGreaterThan(0);
  });
});
