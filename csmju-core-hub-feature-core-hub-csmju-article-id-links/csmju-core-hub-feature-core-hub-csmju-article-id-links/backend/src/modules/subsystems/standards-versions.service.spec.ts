import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  StandardsVersionsService,
  versionsFromTags,
} from './standards-versions.service';

const TAGS_URL = 'https://tags.example/repos/x/tags';

/** What GitHub's "list tags" answers — only `name` matters here. */
const GITHUB_TAGS = [
  { name: 'v1.0.6' },
  { name: 'v1.7.2' },
  { name: 'v1.7.10' },
  { name: 'v1.7.1' },
  { name: 'latest' },
  { name: 'v2.0.0-rc.1' },
  { name: '1.6.0' },
];

/** The service with its fetch replaced by a mock the tests can steer. */
type Testable = Omit<StandardsVersionsService, 'fetchImpl'> & {
  fetchImpl: jest.Mock<Promise<Response>, [string, RequestInit]>;
};

function service(values: Record<string, unknown> = {}): Testable {
  const config = {
    get: (key: string) =>
      (
        ({
          'standards.tagsUrl': TAGS_URL,
          'standards.tagsToken': '',
          'standards.fallbackVersions': ['1.7.2', '1.0.6'],
          ...values,
        }) as Record<string, unknown>
      )[key],
  } as unknown as ConfigService;
  const s = new StandardsVersionsService(config);
  s.fetchImpl = jest.fn<Promise<Response>, [string, RequestInit]>();
  return s as unknown as Testable;
}

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: () => Promise.resolve(body) }) as Response;

describe('versionsFromTags', () => {
  it('keeps vX.Y.Z only, strips the v and sorts newest first (numerically)', () => {
    expect(versionsFromTags(GITHUB_TAGS)).toEqual([
      '1.7.10',
      '1.7.2',
      '1.7.1',
      '1.0.6',
    ]);
  });

  it('refuses an answer that is not a list', () => {
    expect(() => versionsFromTags({ message: 'Not Found' })).toThrow();
  });
});

describe('StandardsVersionsService', () => {
  let clock: number;

  beforeEach(() => {
    clock = Date.parse('2026-10-05T00:00:00Z');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  function at(s: Testable) {
    s.now = () => clock;
    return s;
  }

  it('R8 · fetches the tags from STANDARDS_TAGS_URL, newest first without v', async () => {
    const s = at(service());
    s.fetchImpl.mockResolvedValue(
      json([{ name: 'v1.7.2' }, { name: 'v1.7.1' }]),
    );

    await expect(s.list()).resolves.toEqual({
      versions: ['1.7.2', '1.7.1'],
      source: 'github',
    });

    const [url, init] = s.fetchImpl.mock.calls[0];
    expect(url).toBe(TAGS_URL);
    expect(init.headers).toMatchObject({ 'User-Agent': 'csmju-core-hub' });
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('R8 · a second call within an hour does not reach GitHub again', async () => {
    const s = at(service());
    s.fetchImpl.mockResolvedValue(json([{ name: 'v1.7.2' }]));

    await s.list();
    clock += 59 * 60 * 1000;
    await expect(s.list()).resolves.toEqual({
      versions: ['1.7.2'],
      source: 'cache',
    });
    expect(s.fetchImpl).toHaveBeenCalledTimes(1);

    clock += 2 * 60 * 1000; // past the hour
    s.fetchImpl.mockResolvedValue(
      json([{ name: 'v1.7.3' }, { name: 'v1.7.2' }]),
    );
    await expect(s.list()).resolves.toEqual({
      versions: ['1.7.3', '1.7.2'],
      source: 'github',
    });
    expect(s.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('shares one fetch between concurrent callers', async () => {
    const s = at(service());
    s.fetchImpl.mockResolvedValue(json([{ name: 'v1.7.2' }]));

    await Promise.all([s.list(), s.list(), s.list()]);
    expect(s.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('R9 · GitHub down after a good fetch → the last list, and no retry per request', async () => {
    const s = at(service());
    s.fetchImpl.mockResolvedValue(json([{ name: 'v1.7.2' }]));
    await s.list();

    clock += 61 * 60 * 1000;
    s.fetchImpl.mockRejectedValue(new TypeError('fetch failed'));
    await expect(s.list()).resolves.toEqual({
      versions: ['1.7.2'],
      source: 'cache',
    });
    await s.list();
    expect(s.fetchImpl).toHaveBeenCalledTimes(2); // one failure, then back off
  });

  it.each([
    [
      'rate limited (403)',
      () => Promise.resolve(json({ message: 'API rate limit' }, 403)),
    ],
    [
      'a wrong URL (404)',
      () => Promise.resolve(json({ message: 'Not Found' }, 404)),
    ],
    [
      'a timeout',
      () => Promise.reject(new DOMException('timed out', 'TimeoutError')),
    ],
    ['no release tags', () => Promise.resolve(json([{ name: 'latest' }]))],
  ])(
    'R9 · never fetched and %s → STANDARDS_VERSIONS_FALLBACK, no error',
    async (_, answer) => {
      const s = at(service());
      s.fetchImpl.mockImplementation(answer);

      await expect(s.list()).resolves.toEqual({
        versions: ['1.7.2', '1.0.6'],
        source: 'fallback',
      });
    },
  );

  it('logs the failure without the URL or the token', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn');
    const s = at(service({ 'standards.tagsToken': 'secret-token-value' }));
    s.fetchImpl.mockRejectedValue(new TypeError('fetch failed'));

    await s.list();

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('standards_versions.fetch_failed');
    expect(logged).not.toContain('tags.example');
    expect(logged).not.toContain('secret-token-value');
  });

  it('sends STANDARDS_TAGS_TOKEN as a bearer token when set (private repo)', async () => {
    const s = at(service({ 'standards.tagsToken': 'gh-token' }));
    s.fetchImpl.mockResolvedValue(json([{ name: 'v1.7.2' }]));

    await s.list();

    const [, init] = s.fetchImpl.mock.calls[0];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer gh-token' });
  });

  it('without STANDARDS_TAGS_URL never fetches and uses the fallback', async () => {
    const s = at(service({ 'standards.tagsUrl': '' }));

    await expect(s.list()).resolves.toMatchObject({ source: 'fallback' });
    expect(s.fetchImpl).not.toHaveBeenCalled();
  });

  it('isKnown checks against the current list', async () => {
    const s = at(service());
    s.fetchImpl.mockResolvedValue(json([{ name: 'v1.7.2' }]));

    await expect(s.isKnown('1.7.2')).resolves.toBe(true);
    await expect(s.isKnown('9.9.9')).resolves.toBe(false);
    await expect(s.isKnown('v1.7.2')).resolves.toBe(false);
  });
});
