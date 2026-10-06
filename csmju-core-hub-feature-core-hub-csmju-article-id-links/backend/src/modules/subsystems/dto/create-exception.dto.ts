import { IsIn, IsString, MinLength } from 'class-validator';

import { CORE_ROLES } from '../subsystem-access';

export class CreateExceptionDto {
  @IsString()
  @MinLength(1)
  username!: string;

  /** A core role; the service also requires it to be a key of the mapping. */
  @IsIn(CORE_ROLES, {
    message: `role must be one of ${CORE_ROLES.join(', ')}`,
  })
  role!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}
