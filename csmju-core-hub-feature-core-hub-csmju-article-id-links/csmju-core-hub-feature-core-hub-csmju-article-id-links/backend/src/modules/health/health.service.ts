import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'ok',
      service: 'core-api',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  getLiveness() {
    return {
      status: 'ok',
      service: 'core-api',
      check: 'liveness',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  getReadiness() {
    return {
      status: 'ready',
      service: 'core-api',
      check: 'readiness',
      timestamp: new Date().toISOString(),
    };
  }
}
