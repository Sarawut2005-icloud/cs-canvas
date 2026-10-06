import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../authorization/permissions.guard';
import { Permissions } from '../authorization/permissions.decorator';
import { Permission } from '../authorization/permission.enum';
import {
  AnnouncementsService,
  MAX_IMAGE_BYTES,
  type UploadedImage,
} from './announcements.service';
import {
  CreateAnnouncementDto,
  ListAnnouncementsQuery,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

/**
 * Backoffice announcements. Every route declares a permission —
 * PermissionsGuard lets an undecorated route through. Reads need
 * `content:update`, not `content:read`: every role holds `content:read` for
 * published news, and these routes also return drafts.
 */
@Controller('announcements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @Permissions(Permission.CONTENT_UPDATE)
  list(@Query() query: ListAnnouncementsQuery) {
    return this.announcementsService.list(query);
  }

  @Get(':id')
  @Permissions(Permission.CONTENT_UPDATE)
  getById(@Param('id') id: string) {
    return this.announcementsService.findOne(id);
  }

  @Post()
  @Permissions(Permission.CONTENT_CREATE)
  create(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcementsService.create(dto, user.id);
  }

  @Patch(':id')
  @Permissions(Permission.CONTENT_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcementsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.CONTENT_DELETE)
  delete(@Param('id') id: string) {
    return this.announcementsService.delete(id);
  }

  /** The raw image bytes — not wrapped in the JSON envelope. */
  @Get(':id/image')
  @Header('X-Content-Type-Options', 'nosniff')
  @Permissions(Permission.CONTENT_UPDATE)
  async getImage(@Param('id') id: string) {
    const image = await this.announcementsService.getImage(id);
    return new StreamableFile(image.data, {
      type: image.type,
      length: image.data.length,
    });
  }

  /** `multipart/form-data` with the file in the `image` field. */
  @Put(':id/image')
  @Permissions(Permission.CONTENT_UPDATE)
  // multer stops reading past the limit and answers 413 File too large.
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  setImage(
    @Param('id') id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ) {
    return this.announcementsService.setImage(id, file);
  }

  @Delete(':id/image')
  @Permissions(Permission.CONTENT_UPDATE)
  removeImage(@Param('id') id: string) {
    return this.announcementsService.removeImage(id);
  }
}
