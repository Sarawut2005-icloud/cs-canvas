import { IsEnum, IsIn, IsOptional } from 'class-validator';

import { ImageCategory } from '../../../../generated/prisma/client';
import { PaginationQuery } from '../../subsystems/dto/list-subsystems.query';

export class ListImagesQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(ImageCategory)
  category?: ImageCategory;
}

export class ImageFileQuery {
  /** `thumb` serves the 400px copy, or the full image when there is none. */
  @IsOptional()
  @IsIn(['thumb'])
  size?: 'thumb';
}
