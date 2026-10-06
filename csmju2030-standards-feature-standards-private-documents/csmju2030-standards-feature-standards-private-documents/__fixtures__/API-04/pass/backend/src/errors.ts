// ครบ 9 ค่าของ contracts/error-codes.json (standards 1.1) — ต้องผ่าน
export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export function tooManyRequests(retryAfterSec: number) {
  return {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: `Retry after ${retryAfterSec}s` },
  };
}

export function serviceUnavailable() {
  return { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Try again shortly' } };
}
