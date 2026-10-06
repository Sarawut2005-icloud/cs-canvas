import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import configuration from './config/configuration';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './database/prisma.module';
import { SubsystemsModule } from './modules/subsystems/subsystems.module';
import { ImagesModule } from './modules/images/images.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { ReferenceDataModule } from './modules/reference-data/reference-data.module';
import { PeopleModule } from './modules/people/people.module';
import { ContentModule } from './modules/content/content.module';
import { BackofficeModule } from './modules/backoffice/backoffice.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { ExternalContentModule } from './modules/external-content/external-content.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SearchModule } from './modules/search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),

    HealthModule,
    AuthModule,
    PrismaModule,
    SubsystemsModule,
    ImagesModule,
    RateLimitModule,
    ReferenceDataModule,
    PeopleModule,
    ContentModule,
    BackofficeModule,
    AnnouncementsModule,
    ExternalContentModule,
    NotificationsModule,
    SearchModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}
