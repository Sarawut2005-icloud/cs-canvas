import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { ListNotificationsQuery } from './dto/list-notifications.query';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { NotificationsService } from './notifications.service';

/** Ids are server-made UUID v4; anything else is a malformed request. */
const NOTIFICATION_ID = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new BadRequestException(['id must be a UUID v4']),
});

/**
 * `/api/v1/notifications` — the signed-in user's own notifications. Every
 * route declares a permission (PermissionsGuard lets an undecorated route
 * through); the service scopes every query to the caller.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Permissions(Permission.NOTIFICATION_READ_OWN)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQuery,
  ) {
    return this.notifications.listMine(user.id, query);
  }

  /** Marks all of the caller's notifications read. */
  @Patch()
  @Permissions(Permission.NOTIFICATION_UPDATE_OWN)
  markAllRead(
    @CurrentUser() user: AuthenticatedUser,
    // Validated only: `{ "read": true }` is the one change allowed.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() _dto: UpdateNotificationsDto,
  ) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  @Permissions(Permission.NOTIFICATION_UPDATE_OWN)
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', NOTIFICATION_ID) id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }
}
