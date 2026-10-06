import { IsEnum, IsOptional, IsUrl, ValidateIf } from 'class-validator';

import { ChangeRequestStatus } from '../../../../generated/prisma/client';
import { PaginationQuery } from './list-subsystems.query';
import { IsRoleMapping } from './role-mapping.validator';

/**
 * `POST /subsystems/:id/change-requests` — new values for the fields that
 * are locked once a subsystem is approved. Same shape rules as registration;
 * the transport rule (HTTPS, or http://localhost while
 * ALLOW_LOCALHOST_CALLBACKS is on) is enforced in the service, now and again
 * when the request is approved. Send only the fields to change.
 */
export class CreateChangeRequestDto {
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  callbackUrl?: string;

  /** An empty string removes the base URL (the Monitor then shows NO_BASE_URL). */
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsUrl(
    { require_protocol: true, require_tld: false },
    { message: 'baseUrl must be a URL, or an empty string to remove it' },
  )
  baseUrl?: string;

  @IsOptional()
  @IsRoleMapping()
  defaultRoleMapping?: Record<string, string>;
}

export class ListChangeRequestsQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(ChangeRequestStatus)
  status?: ChangeRequestStatus;
}
