/**
 * Error the Core API answered with. Kept apart from `api.ts` (which imports
 * `next/headers`) so client components can `instanceof` it without dragging
 * server-only modules into the browser bundle.
 */
/** Closed `error.code` enum — csmju2030-standards/contracts/error-codes.json. */
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";


export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  details: string[];
  constructor(
    message: string,
    status: number,
    code?: ApiErrorCode,
    details: string[] = [],
  ) {
    super(message);
    this.status = status;
    this.code = code ?? (status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST");
    this.details = details;
  }
}
