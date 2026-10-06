import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  SubsystemApprovalStatus,
  SubsystemExceptionStatus,
  SubsystemStatus,
} from '../../../../generated/prisma/client';

/** `?page=&limit=` — api-conventions.md §5 (default 20, max 100). */
export class PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class ListSubsystemsQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(SubsystemApprovalStatus)
  approvalStatus?: SubsystemApprovalStatus;

  @IsOptional()
  @IsEnum(SubsystemStatus)
  status?: SubsystemStatus;

  /** Matches `name` or `displayName`, case-insensitive. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ListExceptionsQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(SubsystemExceptionStatus)
  status?: SubsystemExceptionStatus;
}
