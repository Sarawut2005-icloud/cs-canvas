import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration for the Core Hub.
 *
 * `datasource.url` is attached only when DATABASE_URL is actually set.
 *
 * Why: `prisma generate` runs from postinstall, which happens on a fresh clone
 * and on CI before anyone has written a `.env`. Declaring the datasource with
 * `env('DATABASE_URL')` made config loading throw
 * `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`
 * and that failed `pnpm install` itself. Generating the client needs no
 * database connection, so it must not require the variable.
 *
 * Commands that really do need a database (`migrate deploy`, `db seed`) still
 * fail loudly when it is missing — Prisma answers "The datasource.url property
 * is required in your Prisma config file" — and a placeholder URL is
 * deliberately NOT used, both to avoid pointing anywhere unexpected and
 * because a hardcoded connection string is a `SEC-01` violation.
 */
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // `pnpm prisma db seed` — ต้อง `pnpm build` ก่อน (seed ถูก compile ไปที่ dist/)
    seed: 'node dist/prisma/seed.js',
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
