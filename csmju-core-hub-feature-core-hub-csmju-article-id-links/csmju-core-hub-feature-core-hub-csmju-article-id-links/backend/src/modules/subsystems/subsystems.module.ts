import { Module } from '@nestjs/common';

import {
  SubsystemExceptionsController,
  SubsystemsController,
} from './subsystems.controller';
import { SubsystemsService } from './subsystems.service';
import { SubsystemHealthService } from './subsystem-health.service';
import { StandardsVersionsService } from './standards-versions.service';

@Module({
  controllers: [SubsystemsController, SubsystemExceptionsController],
  providers: [
    SubsystemsService,
    SubsystemHealthService,
    StandardsVersionsService,
  ],
  exports: [SubsystemsService],
})
export class SubsystemsModule {}
