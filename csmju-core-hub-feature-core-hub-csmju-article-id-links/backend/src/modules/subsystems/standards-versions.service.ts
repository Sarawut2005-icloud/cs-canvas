import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const CACHE_MS = 60 * 60 * 1000;
/** After a failed fetch, keep serving what we have before asking again. */
const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;
const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

export interface StandardsVersions {
  /** Newest first, without the leading `v` (e.g. `1.7.2`). */
  versions: string[];
  /** Where the list came from: a fetch, an earlier fetch, or the env fallback. */
  source: 'github' | 'cache' | 'fallback';
}

/** Compares `X.Y.Z` strings, newest first. */
function newestFirst(a: string, b: string): number {
  const [pa, pb] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pb[i] - pa[i];
  }
  return 0;
}

/** Release versions out of a GitHub "list tags" answer. */
export function versionsFromTags(body: unknown): string[] {
  if (!Array.isArray(body)) {
    throw new Error('tags answer is not an array');
  }
  const versions = body
    .map((tag) => (tag as { name?: unknown })?.name)
    .filter((name): name is string => typeof name === 'string')
    .map((name) => RELEASE_TAG.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(([, major, minor, patch]) => `${major}.${minor}.${patch}`);
  return [...new Set(versions)].sort(newestFirst);
}

/**
 * The versions of csmju2030-standards a subsystem may declare, from the
 * repository's real tags (PM 2026-10-05, handoff 2.6):
 *
 *  - fetched by the backend with Node's fetch (5 s timeout, no dependency),
 *    never from the browser;
 *  - cached in memory for an hour — repeated calls do not reach GitHub;
 *  - when GitHub is down or rate-limited, the last good list is served, and
 *    the next attempt waits a few minutes rather than hitting it per request;
 *  - when no fetch has ever worked, STANDARDS_VERSIONS_FALLBACK is used.
 *
 * The URL comes from STANDARDS_TAGS_URL and an optional bearer token from
 * STANDARDS_TAGS_TOKEN (for a future private repository) — neither is in
 * the code, and neither is ever logged.
 */
@Injectable()
export class StandardsVersionsService {
  private readonly logger = new Logger(StandardsVersionsService.name);

  private cached: string[] | null = null;
  private cachedAt = 0;
  private nextAttemptAt = 0;
  private inFlight: Promise<string[] | null> | null = null;

  /** Replaced by tests; production uses the global fetch. */
  fetchImpl: (url: string, init: RequestInit) => Promise<Response> = (
    url,
    init,
  ) => fetch(url, init);

  /** Replaced by tests to move time on. */
  now: () => number = () => Date.now();

  constructor(private readonly config: ConfigService) {}

  async list(): Promise<StandardsVersions> {
    const now = this.now();

    if (this.cached && now - this.cachedAt < CACHE_MS) {
      return { versions: this.cached, source: 'cache' };
    }

    if (now >= this.nextAttemptAt) {
      const fetched = await this.fetchOnce();
      if (fetched) return { versions: fetched, source: 'github' };
    }

    if (this.cached) return { versions: this.cached, source: 'cache' };

    return { versions: this.fallback(), source: 'fallback' };
  }

  /** True when `version` may be stored as a subsystem's standardsVersion. */
  async isKnown(version: string): Promise<boolean> {
    return (await this.list()).versions.includes(version);
  }

  private fallback(): string[] {
    const configured =
      this.config.get<string[]>('standards.fallbackVersions') ?? [];
    return [...new Set(configured)]
      .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
      .sort(newestFirst);
  }

  /** One fetch at a time; concurrent callers share it. */
  private fetchOnce(): Promise<string[] | null> {
    this.inFlight ??= this.fetchTags().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async fetchTags(): Promise<string[] | null> {
    const url = this.config.get<string>('standards.tagsUrl') ?? '';
    if (!url) {
      this.nextAttemptAt = Number.POSITIVE_INFINITY;
      return null;
    }

    const token = this.config.get<string>('standards.tagsToken') ?? '';

    try {
      const response = await this.fetchImpl(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          // GitHub refuses API calls without a User-Agent.
          'User-Agent': 'csmju-core-hub',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }

      const versions = versionsFromTags(await response.json());
      if (versions.length === 0) {
        throw new Error('no vX.Y.Z tags');
      }

      this.cached = versions;
      this.cachedAt = this.now();
      this.nextAttemptAt = 0;
      return versions;
    } catch (error) {
      this.nextAttemptAt = this.now() + RETRY_AFTER_FAILURE_MS;
      this.logger.warn(
        JSON.stringify({
          event: 'standards_versions.fetch_failed',
          reason: error instanceof Error ? error.message : 'unknown',
          serving: this.cached ? 'cache' : 'fallback',
        }),
      );
      return null;
    }
  }
}
