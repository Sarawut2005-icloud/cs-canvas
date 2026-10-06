import { Module } from '@nestjs/common';

import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { PublishedAnnouncementsController } from './published-announcements.controller';

@Module({
  controllers: [AnnouncementsController, PublishedAnnouncementsController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}
