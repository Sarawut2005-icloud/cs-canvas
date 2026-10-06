import { Module } from '@nestjs/common';

import { SessionService } from './session.service';
import { SessionsController } from './sessions.controller';

@Module({
  controllers: [SessionsController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionsModule {}
