import { IsRoleMapping } from './role-mapping.validator';

export class UpdateRoleMappingDto {
  @IsRoleMapping()
  defaultRoleMapping!: Record<string, string>;
}
