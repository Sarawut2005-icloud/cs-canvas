-- Core roles lecturer and guest (standards 1.6.0 / 1.0.6, PM 2026-09-29).
-- The seed upserts the same rows with their permissions; creating them here
-- lets this migration move the accounts that already exist.
INSERT INTO "roles" ("id", "name", "updated_at") VALUES
  ('role-lecturer', 'lecturer', CURRENT_TIMESTAMP),
  ('role-guest', 'guest', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- staff now means employees who are not lecturers: accounts of people the
-- registry lists as lecturers become lecturer. admin accounts are untouched.
UPDATE "users" SET "role_id" = 'role-lecturer'
WHERE "role_id" = 'role-staff'
  AND "id" IN (
    SELECT "core_user_id" FROM "people"
    WHERE "person_type" = 'STAFF' AND "staff_type" = 'LECTURER' AND "core_user_id" IS NOT NULL
  );
