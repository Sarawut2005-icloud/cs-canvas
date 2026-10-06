import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // api-conventions.md ข้อ 1 (/api/v1) + ข้อ 8 (/health อยู่นอก prefix)
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  await app.listen(3000);
}
bootstrap();
