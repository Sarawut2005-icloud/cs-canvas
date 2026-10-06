import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import type { TrustProxy } from './config/configuration';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Rate limiting keys callers on request.ip, which Express derives from
  // X-Forwarded-For only for the hops TRUST_PROXY trusts. Unset means no proxy
  // in front, so a forged header is ignored. Behind cloudflared and the web
  // container on the dev server: TRUST_PROXY=loopback, uniquelocal.
  const trustProxy = config.get<TrustProxy>('app.trustProxy', false);
  if (trustProxy !== false) {
    app.set('trust proxy', trustProxy);
  }

  // Pre-launch mode must not be forgotten when the server opens for real.
  if (
    config.get<string>('app.environment') === 'production' &&
    config.get<boolean>('app.allowLocalhostCallbacks', false)
  ) {
    new Logger('Bootstrap').warn(
      'ALLOW_LOCALHOST_CALLBACKS=true: accepting http://localhost subsystem callbacks in production — turn it off before launch',
    );
  }

  // CSV imports travel as a JSON string (POST /people/import) — the default
  // 100 KB body limit would cut a real class list off. Anything larger than
  // this is refused before a handler runs (HttpExceptionFilter → 400).
  app.useBodyParser('json', { limit: '2mb' });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new LoggingInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Browsers never call the Core API directly in production — the Next.js
  // frontend talks to it server-side — so CORS stays off unless CORS_ORIGINS
  // lists the exact origins that may use the API from a browser
  // (comma-separated). `origin: true` reflected any origin with credentials,
  // which let every website make authenticated calls in a signed-in user's
  // browser had a token ever been exposed to it.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: true });
  }

  // No fingerprinting header.
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  const port = process.env.PORT || 3000;

  await app.listen(port);

  console.log(`Core API running on http://localhost:${port}`);
}

void bootstrap();
