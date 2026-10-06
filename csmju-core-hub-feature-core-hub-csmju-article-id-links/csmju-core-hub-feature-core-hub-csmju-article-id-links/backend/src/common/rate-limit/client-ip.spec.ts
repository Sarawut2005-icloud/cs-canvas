import { Request } from 'express';

import { getClientIp } from './client-ip';

const requestWith = (
  ip: string | undefined,
  headers: Record<string, string> = {},
) => ({ ip, headers }) as unknown as Request;

describe('getClientIp', () => {
  it('uses the address Express worked out', () => {
    expect(getClientIp(requestWith('203.0.113.7'))).toBe('203.0.113.7');
  });

  // A caller can put anything in these headers. Reading them by hand would let
  // it pick a fresh rate-limit bucket on every request; only TRUST_PROXY,
  // through request.ip, decides whether a forwarded address is believed.
  it.each([
    ['cf-connecting-ip', '198.51.100.1'],
    ['x-forwarded-for', '198.51.100.2'],
    ['x-forwarded-for', '198.51.100.3, 203.0.113.7'],
    ['x-real-ip', '198.51.100.4'],
  ])('ignores a forged %s header', (name, value) => {
    expect(getClientIp(requestWith('203.0.113.7', { [name]: value }))).toBe(
      '203.0.113.7',
    );
  });

  it('falls back to a fixed key when there is no address', () => {
    expect(getClientIp(requestWith(undefined))).toBe('unknown');
    expect(getClientIp(requestWith(''))).toBe('unknown');
  });
});
