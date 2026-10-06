import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  MaxLength,
  IsString,
  IsUrl,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { SubsystemCategory } from '../../../../generated/prisma/client';
import { CreateExceptionDto } from './create-exception.dto';
import {
  IsRoleMapping,
  SUBSYSTEM_NAME_MAX,
  SUBSYSTEM_NAME_PATTERN,
} from './role-mapping.validator';

/** Same shape and rules as `POST /subsystems/:id/exceptions`. */
class RequestedExceptionDto extends CreateExceptionDto {}

export class CreateSubsystemDto {
  @IsString()
  @Length(1, SUBSYSTEM_NAME_MAX)
  @Matches(SUBSYSTEM_NAME_PATTERN, {
    message:
      'name must be lowercase letters and numbers, with single hyphens between words',
  })
  name!: string;

  @IsString()
  displayName!: string;

  /** Group in the portal menu. Optional for existing clients — OTHER. */
  @IsOptional()
  @IsEnum(SubsystemCategory)
  category?: SubsystemCategory;

  /** One line for users: what the subsystem is for. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  /** false hides it from every user's menu. Administrators only. */
  @IsOptional()
  @IsBoolean()
  listedInMenu?: boolean;

  /**
   * `username` of the owner (data-dictionary.md §7). Optional — defaults to
   * the caller. Naming someone else requires `subsystem:update:any`.
   */
  @IsOptional()
  @IsString()
  owner?: string;

  @IsString()
  repo!: string;

  @IsString()
  standardsVersion!: string;

  @IsRoleMapping()
  defaultRoleMapping!: Record<string, string>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestedExceptionDto)
  requestedExceptions?: RequestedExceptionDto[];

  @IsUrl({
    require_protocol: true,
    // Development subsystems register http://localhost:<port>/auth/callback,
    // which has no TLD. The transport rule (HTTPS outside local development)
    // is enforced in SubsystemsService.
    require_tld: false,
  })
  callbackUrl!: string;

  /**
   * Origin the backoffice Monitor probes at `<baseUrl>/api/health`. Optional:
   * a subsystem without one shows `NO_BASE_URL` instead of failing. Same
   * transport rule as `callbackUrl` (HTTPS outside local development).
   */
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  baseUrl?: string;
}
