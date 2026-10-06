import { Module } from '@nestjs/common';

import { ExternalContentController } from './external-content.controller';
import { ExternalContentService } from './external-content.service';

@Module({
  controllers: [ExternalContentController],
  providers: [ExternalContentService],
})
export class ExternalContentModule {}
