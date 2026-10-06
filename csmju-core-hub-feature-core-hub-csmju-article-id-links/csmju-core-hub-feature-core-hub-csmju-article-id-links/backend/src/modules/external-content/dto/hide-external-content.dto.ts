import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { ExternalContentKind } from '../../../../generated/prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** `article` / `banner` in the URL; the enum value in the database. */
export const KIND_BY_SLUG = {
  article: ExternalContentKind.ARTICLE,
  banner: ExternalContentKind.BANNER,
} as const;

export type KindSlug = keyof typeof KIND_BY_SLUG;

export class ExternalContentParams {
  @IsIn(Object.keys(KIND_BY_SLUG))
  kind!: KindSlug;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  externalId!: string;
}

export class HideExternalContentDto {
  /** Kept so the backoffice can still name the item if csmju.com drops it. */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;
}
