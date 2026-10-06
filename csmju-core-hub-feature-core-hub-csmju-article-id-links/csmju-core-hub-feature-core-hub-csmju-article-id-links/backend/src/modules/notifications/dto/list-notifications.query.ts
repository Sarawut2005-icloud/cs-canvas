import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { PaginationQuery } from '../../subsystems/dto/list-subsystems.query';

export class ListNotificationsQuery extends PaginationQuery {
  /** `true` lists only the unread ones. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  unread?: boolean;
}
