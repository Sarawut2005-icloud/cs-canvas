import {
  Query,
  Controller,
  Get,
  Patch,
  Put,
  Param,
  Post,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { Permissions } from '../authorization/permissions.decorator';
import { Permission } from '../authorization/permission.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions(Permission.USER_READ)
  async findAll(@Query('q') q?: string) {
    return this.usersService.findAll(typeof q === 'string' ? q : undefined);
  }

  @Get(':id')
  @Permissions(Permission.USER_READ)
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post('add-user')
  @Permissions(Permission.USER_CREATE)
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch('update/:id')
  @Permissions(Permission.USER_UPDATE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    // The service checks who may change what (roles, admin accounts).
    return this.usersService.update(id, dto, actor);
  }

  /**
   * Per-account permissions on top of the role — a closed list
   * (GRANTABLE_PERMISSIONS, today subsystem:create). user:update is held by
   * admins only, so nobody grants themselves the right to register.
   */
  @Put(':id/permissions/:permission')
  @Permissions(Permission.USER_UPDATE)
  async grantPermission(
    @Param('id') id: string,
    @Param('permission') permission: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.grantPermission(id, permission, actor);
  }

  @Delete(':id/permissions/:permission')
  @Permissions(Permission.USER_UPDATE)
  async revokePermission(
    @Param('id') id: string,
    @Param('permission') permission: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.revokePermission(id, permission, actor);
  }

  @Delete('delete/:id')
  @Permissions(Permission.USER_DELETE)
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
