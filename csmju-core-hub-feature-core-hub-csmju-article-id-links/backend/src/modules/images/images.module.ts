import { Module } from '@nestjs/common';

import { ImageFilesController, ImagesController } from './images.controller';
import { ImagePurgeService } from './image-purge.service';
import { ImageStorageService } from './image-storage.service';
import { ImagesService } from './images.service';

@Module({
  controllers: [ImagesController, ImageFilesController],
  providers: [ImagesService, ImageStorageService, ImagePurgeService],
})
export class ImagesModule {}
