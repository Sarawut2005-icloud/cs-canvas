-- How each session was opened. Setting a password without the current one
-- is allowed only on a session opened through MJU SSO in the last 10 minutes;
-- `created_at` is the sign-in time (refresh rotates tokens on the same row).
CREATE TYPE "AuthMethod" AS ENUM ('PASSWORD', 'MJU_SSO');
ALTER TABLE "sessions" ADD COLUMN "auth_method" "AuthMethod" NOT NULL DEFAULT 'PASSWORD';
