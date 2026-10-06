-- The CSV import gave every student account the guessable password
-- CSMJU@<student code>. Accounts it created (id = user-<student code>) drop
-- that password: students sign in through MJU SSO and set their own.
-- Nobody could have changed it yet — change-password ships in this release.
UPDATE "users" SET "password_hash" = NULL
WHERE "id" LIKE 'user-%'
  AND "id" IN (
    SELECT "core_user_id" FROM "people"
    WHERE "person_type" = 'STUDENT' AND "core_user_id" IS NOT NULL
  );

-- Sessions opened with that password end too: an account without a password
-- may set one without the current password, so a session that was opened by
-- guessing CSMJU@<code> must not survive to do it.
UPDATE "sessions" SET "status" = 'REVOKED', "revoked_at" = now()
WHERE "status" = 'ACTIVE'
  AND "user_id" LIKE 'user-%'
  AND "user_id" IN (
    SELECT "core_user_id" FROM "people"
    WHERE "person_type" = 'STUDENT' AND "core_user_id" IS NOT NULL
  );
