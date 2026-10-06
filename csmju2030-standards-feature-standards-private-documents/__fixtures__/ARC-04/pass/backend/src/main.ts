import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
void NestFactory.create(AppModule).then((app) => app.listen(3002));
