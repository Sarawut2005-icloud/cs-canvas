import type { StandardsVersionsService } from './standards-versions.service';

/**
 * For specs that are not about standards versions: every version is known,
 * so a registration's `standardsVersion` never decides their outcome.
 */
export function anyStandardsVersion(
  versions: string[] = ['1.7.2'],
): StandardsVersionsService {
  return {
    list: () => Promise.resolve({ versions, source: 'fallback' as const }),
    isKnown: () => Promise.resolve(true),
  } as unknown as StandardsVersionsService;
}
