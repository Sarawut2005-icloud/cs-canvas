import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { PaginationQuery } from '../../subsystems/dto/list-subsystems.query';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** `"true"` / `"false"` from a query string; booleans from a JSON body. */
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class CreateAnnouncementDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category!: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

/**
 * Every field optional. Written out rather than `PartialType(...)` because
 * @nestjs/mapped-types ships ESM only and jest cannot load it
 * (backend/README.md §11).
 */
export class UpdateAnnouncementDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class ListAnnouncementsQuery extends PaginationQuery {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isPublished?: boolean;

  /** Matches `title` or `category`, case-insensitive. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
