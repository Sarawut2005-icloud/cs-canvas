import { Module } from '@nestjs/common';
import { BackofficeController } from './backoffice.controller';
import { BackofficeSummaryService } from './backoffice-summary.service';

/** หน้าแรก backoffice: สรุปตัวเลขจากทุกโมดูลในคำขอเดียว */
@Module({
  controllers: [BackofficeController],
  providers: [BackofficeSummaryService],
})
export class BackofficeModule {}
