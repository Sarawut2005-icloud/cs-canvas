import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { SkipRateLimit } from '../../common/rate-limit/rate-limit.decorator';

// The Docker healthcheck polls every 10 s and the watchdog every 5 min. A
// throttled probe would read as "down" and get the container restarted.
@SkipRateLimit()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get('live')
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  getReadiness() {
    return this.healthService.getReadiness();
  }
}
