-- CreateEnum
CREATE TYPE "SubsystemApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubsystemStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubsystemExceptionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "subsystems" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "standards_version" TEXT NOT NULL,
    "default_role_mapping" JSONB NOT NULL,
    "callback_url" TEXT NOT NULL,
    "approval_status" "SubsystemApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "status" "SubsystemStatus" NOT NULL DEFAULT 'INACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subsystems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsystem_exceptions" (
    "id" TEXT NOT NULL,
    "subsystem_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" "SubsystemExceptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subsystem_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subsystems_name_key" ON "subsystems"("name");

-- CreateIndex
CREATE INDEX "subsystems_owner_id_idx" ON "subsystems"("owner_id");

-- CreateIndex
CREATE INDEX "subsystems_approval_status_idx" ON "subsystems"("approval_status");

-- CreateIndex
CREATE INDEX "subsystems_status_idx" ON "subsystems"("status");

-- CreateIndex
CREATE INDEX "subsystem_exceptions_subsystem_id_idx" ON "subsystem_exceptions"("subsystem_id");

-- CreateIndex
CREATE INDEX "subsystem_exceptions_username_idx" ON "subsystem_exceptions"("username");

-- AddForeignKey
ALTER TABLE "subsystems" ADD CONSTRAINT "subsystems_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsystem_exceptions" ADD CONSTRAINT "subsystem_exceptions_subsystem_id_fkey" FOREIGN KEY ("subsystem_id") REFERENCES "subsystems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
