import {
  Body,
  Controller,
  Param,
  Post,
  Patch,
  Get,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common';

import { CreateSubsystemDto } from './dto/create-subsystem.dto';
import { SubsystemsService } from './subsystems.service';
import { SubsystemHealthService } from './subsystem-health.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateSubsystemDto } from './dto/update-subsystem.dto';
import { UpdateRoleMappingDto } from './dto/update-role-mapping.dto';
import { CreateExceptionDto } from './dto/create-exception.dto';
import {
  ListExceptionsQuery,
  ListSubsystemsQuery,
} from './dto/list-subsystems.query';
import { OptionalReasonDto, RequiredReasonDto } from './dto/status-reason.dto';
import {
  CreateChangeRequestDto,
  ListChangeRequestsQuery,
} from './dto/change-request.dto';
import { PaginationQuery } from './dto/list-subsystems.query';
import { StandardsVersionsService } from './standards-versions.service';
import { PermissionsGuard } from '../authorization/permissions.guard';
import {
  AnyPermissions,
  Permissions,
} from '../authorization/permissions.decorator';
import { Permission } from '../authorization/permission.enum';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';

const READ = [Permission.SUBSYSTEM_READ_OWN, Permission.SUBSYSTEM_READ_ANY];
const EDIT = [Permission.SUBSYSTEM_UPDATE_OWN, Permission.SUBSYSTEM_UPDATE_ANY];

/**
 * Every route declares a permission — PermissionsGuard lets an undecorated
 * route through, so a missing decorator would make it open to any signed-in
 * user. `:own` routes are narrowed to the caller's records in the service.
 */
@Controller('subsystems')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubsystemsController {
  constructor(
    private readonly subsystemsService: SubsystemsService,
    private readonly health: SubsystemHealthService,
    private readonly standardsVersions: StandardsVersionsService,
  ) {}

  @Post()
  @Permissions(Permission.SUBSYSTEM_CREATE)
  async create(
    @Body() dto: CreateSubsystemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.create(dto, user);
  }

  @Get()
  @AnyPermissions(...READ)
  async list(
    @Query() query: ListSubsystemsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.list(query, user);
  }

  @Get('summary')
  @AnyPermissions(...READ)
  async summary(@CurrentUser() user: AuthenticatedUser) {
    return this.subsystemsService.summary(user);
  }

  @Get('directory')
  @Permissions(Permission.SYSTEM_READ)
  async directory(@CurrentUser() user: AuthenticatedUser) {
    return this.subsystemsService.directory(user);
  }

  @Get('all')
  @Permissions(Permission.SUBSYSTEM_READ_ANY)
  async findAll() {
    return this.subsystemsService.findAll();
  }

  /**
   * Versions a registration may declare — the real tags of
   * csmju2030-standards, newest first, fetched and cached by the backend.
   * For whoever may register or edit a subsystem.
   */
  @Get('standards-versions')
  @AnyPermissions(Permission.SUBSYSTEM_CREATE, ...EDIT)
  async standardsVersionList() {
    return this.standardsVersions.list();
  }

  /** Change requests across the registry (the reviewers' "คำขอ" page). */
  @Get('change-requests')
  @Permissions(Permission.SUBSYSTEM_REVIEW)
  async listAllChangeRequests(@Query() query: ListChangeRequestsQuery) {
    return this.subsystemsService.listAllChangeRequests(query);
  }

  @Get(':id')
  @AnyPermissions(...READ)
  getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.subsystemsService.findOne(id, user);
  }

  /**
   * Monitor: probes the registered `baseUrl` server-side. The browser never
   * talks to a subsystem directly, and no URL is taken from the request.
   */
  @Get(':id/health')
  @AnyPermissions(...READ)
  async checkHealth(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.health.check(id, user);
  }

  @Patch(':id')
  @AnyPermissions(...EDIT)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSubsystemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.update(id, dto, user);
  }

  /* Change requests for the reviewed fields of an approved subsystem. */

  @Post(':id/change-requests')
  @AnyPermissions(...EDIT)
  async createChangeRequest(
    @Param('id') id: string,
    @Body() dto: CreateChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.createChangeRequest(id, dto, user);
  }

  @Get(':id/change-requests')
  @AnyPermissions(...READ)
  async listChangeRequests(
    @Param('id') id: string,
    @Query() query: ListChangeRequestsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.listChangeRequests(id, query, user);
  }

  @Post(':id/change-requests/:requestId/approve')
  @Permissions(Permission.SUBSYSTEM_REVIEW)
  async approveChangeRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.approveChangeRequest(id, requestId, user);
  }

  @Post(':id/change-requests/:requestId/reject')
  @Permissions(Permission.SUBSYSTEM_REVIEW)
  async rejectChangeRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: RequiredReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.rejectChangeRequest(
      id,
      requestId,
      dto.reason,
      user,
    );
  }

  @Post(':id/change-requests/:requestId/cancel')
  @AnyPermissions(...EDIT)
  async cancelChangeRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.cancelChangeRequest(id, requestId, user);
  }

  /** Who changed what, when, from what to what — newest first. */
  @Get(':id/history')
  @AnyPermissions(...READ)
  async history(
    @Param('id') id: string,
    @Query() query: PaginationQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.history(id, query, user);
  }

  @Delete(':id')
  @Permissions(Permission.SUBSYSTEM_DELETE)
  async delete(@Param('id') id: string) {
    return this.subsystemsService.delete(id);
  }

  // Approval and rejection:
  @Post(':id/approve')
  @Permissions(Permission.SUBSYSTEM_REVIEW)
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.approve(id, user);
  }

  @Post(':id/reject')
  @Permissions(Permission.SUBSYSTEM_REVIEW)
  async reject(
    @Param('id') id: string,
    @Body() dto: RequiredReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.reject(id, dto.reason, user);
  }

  @Post(':id/resubmit')
  @AnyPermissions(...EDIT)
  async resubmit(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.resubmit(id, user);
  }

  // Lifecycle:
  @Post(':id/activate')
  @Permissions(Permission.SUBSYSTEM_OPERATE)
  async activate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.activate(id, user);
  }

  @Post(':id/deactivate')
  @Permissions(Permission.SUBSYSTEM_OPERATE)
  async deactivate(
    @Param('id') id: string,
    @Body() dto: OptionalReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.deactivate(id, dto.reason, user);
  }

  @Post(':id/suspend')
  @Permissions(Permission.SUBSYSTEM_OPERATE)
  async suspend(
    @Param('id') id: string,
    @Body() dto: RequiredReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.suspend(id, dto.reason, user);
  }

  @Get(':id/role-mapping')
  @AnyPermissions(...READ)
  async getRoleMapping(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.getRoleMapping(id, user);
  }

  @Patch(':id/role-mapping')
  @AnyPermissions(...EDIT)
  async updateRoleMapping(
    @Param('id') id: string,
    @Body() dto: UpdateRoleMappingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.updateRoleMapping(id, dto, user);
  }

  @Post(':id/exceptions')
  @AnyPermissions(...EDIT)
  async createException(
    @Param('id') id: string,
    @Body() dto: CreateExceptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.createException(id, dto, user);
  }

  @Get(':id/exceptions')
  @AnyPermissions(...READ)
  async getExceptions(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.getExceptions(id, user);
  }

  @Post(':id/exceptions/:exceptionId/approve')
  @Permissions(Permission.SUBSYSTEM_REVIEW)
  async approveException(
    @Param('id') id: string,
    @Param('exceptionId') exceptionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.approveException(id, exceptionId, user);
  }

  @Post(':id/exceptions/:exceptionId/reject')
  @Permissions(Permission.SUBSYSTEM_REVIEW)
  async rejectException(
    @Param('id') id: string,
    @Param('exceptionId') exceptionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subsystemsService.rejectException(id, exceptionId, user);
  }
}

/** Exception requests across every subsystem — the admin review queue. */
@Controller('subsystem-exceptions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubsystemExceptionsController {
  constructor(private readonly subsystemsService: SubsystemsService) {}

  @Get()
  @Permissions(Permission.SUBSYSTEM_REVIEW)
  async list(@Query() query: ListExceptionsQuery) {
    return this.subsystemsService.listExceptions(query);
  }
}
