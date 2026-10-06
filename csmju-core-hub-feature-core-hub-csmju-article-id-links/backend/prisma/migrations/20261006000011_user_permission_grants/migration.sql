-- Permissions given to one account on top of its role. subsystem:create
-- leaves the staff and lecturer roles in this release, so every account
-- that already owns a subsystem keeps the right through a grant.
-- granted_by_id is NULL: the grant comes from this migration, not an admin.

-- CreateTable
CREATE TABLE "user_permission_grants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_permission_grants_granted_by_id_idx" ON "user_permission_grants"("granted_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_grants_user_id_permission_key" ON "user_permission_grants"("user_id", "permission");

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing owners keep the right to register subsystems.
INSERT INTO "user_permission_grants" ("id", "user_id", "permission", "granted_by_id")
SELECT gen_random_uuid()::text, "owner_id", 'subsystem:create', NULL
FROM (SELECT DISTINCT "owner_id" FROM "subsystems") AS owners
ON CONFLICT ("user_id", "permission") DO NOTHING;
