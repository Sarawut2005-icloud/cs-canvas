import { Module } from '@nestjs/common';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

/** เนื้อหา (content): ประกาศ/ข่าวของสาขา — เฟสนี้อ่านอย่างเดียว editor เป็นเฟสหลัง */
@Module({
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class ContentModule {}
