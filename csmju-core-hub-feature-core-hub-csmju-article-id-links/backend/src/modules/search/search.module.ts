import { Module } from '@nestjs/common';

import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/** Backoffice header search across people, registry, content and reference data. */
@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
