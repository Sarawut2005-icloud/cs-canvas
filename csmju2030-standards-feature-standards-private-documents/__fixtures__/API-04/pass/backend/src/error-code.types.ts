// enum และ type union ที่ใช้เฉพาะค่าในรายการ — ต้องผ่านเช่นกัน
export enum HttpErrorCode {
  NOT_FOUND = 'NOT_FOUND',
}

export enum ErrorCodeEnumStyle {
  CONFLICT = 'CONFLICT',
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'TOO_MANY_REQUESTS'
  | 'SERVICE_UNAVAILABLE';
