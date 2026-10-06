import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { Permissions } from '../authorization/permissions.decorator';
import { Permission } from '../authorization/permission.enum';
import {
  ExternalContentParams,
  HideExternalContentDto,
} from './dto/hide-external-content.dto';
import { ExternalContentService } from './external-content.service';

/**
 * Which csmju.com items the public front page leaves out. Reading the list is
 * public — the front page renders for signed-out visitors and the ids are
 * csmju.com's own public ids. Changing it is admin-only.
 */
@Controller('external-content')
export class ExternalContentController {
  constructor(private readonly externalContent: ExternalContentService) {}

  @Get('hidden')
  listHidden() {
    return this.externalContent.listHidden();
  }

  @Put('hidden/:kind/:externalId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.CONTENT_EXTERNAL_MANAGE)
  hide(
    @Param() { kind, externalId }: ExternalContentParams,
    @Body() dto: HideExternalContentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalContent.hide(kind, externalId, dto.title, user.id);
  }

  @Delete('hidden/:kind/:externalId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.CONTENT_EXTERNAL_MANAGE)
  show(@Param() { kind, externalId }: ExternalContentParams) {
    return this.externalContent.show(kind, externalId);
  }
}
