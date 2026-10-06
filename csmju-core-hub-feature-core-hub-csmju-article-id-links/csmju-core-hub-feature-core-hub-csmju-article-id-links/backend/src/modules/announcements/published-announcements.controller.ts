import {
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Query,
  StreamableFile,
} from '@nestjs/common';

import { AnnouncementsService } from './announcements.service';

/** Most the front page asks for in one call. */
const MAX_LIMIT = 50;

/**
 * Published announcements for the public front page, which renders for
 * signed-out visitors — so no guard. Drafts answer 404, and authors are
 * left out. Writing stays on the guarded AnnouncementsController.
 */
@Controller('published-announcements')
export class PublishedAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  list(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number) {
    return this.announcementsService.listPublished(
      Math.min(Math.max(limit, 1), MAX_LIMIT),
    );
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.announcementsService.findPublished(id);
  }

  /** The raw image bytes — not wrapped in the JSON envelope. */
  @Get(':id/image')
  @Header('X-Content-Type-Options', 'nosniff')
  async getImage(@Param('id') id: string) {
    const image = await this.announcementsService.getImage(id, {
      publishedOnly: true,
    });
    return new StreamableFile(image.data, {
      type: image.type,
      length: image.data.length,
    });
  }
}
