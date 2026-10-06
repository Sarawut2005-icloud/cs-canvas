import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { ImageCategory } from '../../../../generated/prisma/client';

/** The text fields of the multipart upload; the file itself is `file`. */
export class UploadImageDto {
  @IsEnum(ImageCategory)
  category: ImageCategory;

  /**
   * Approved, active subsystem the upload comes through. A label only —
   * anyone may name any such subsystem, so it must never decide permissions.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subsystem?: string;
}
