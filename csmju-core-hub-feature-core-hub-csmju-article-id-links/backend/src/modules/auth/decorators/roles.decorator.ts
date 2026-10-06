import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../guards/roles.guard';
import { UserRole } from 'src/modules/users/user-role.enum';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
