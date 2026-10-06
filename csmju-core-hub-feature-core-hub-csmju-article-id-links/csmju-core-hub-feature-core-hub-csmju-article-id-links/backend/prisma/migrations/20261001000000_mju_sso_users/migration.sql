-- MJU SSO sign-in: accounts created from sso.mju.ac.th have no local password,
-- and are linked to the SSO identity through a keyed hash of citizenID
-- (the raw national ID is never stored).
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "mju_subject" TEXT;
CREATE UNIQUE INDEX "users_mju_subject_key" ON "users"("mju_subject");
