-- Change requests for the reviewed fields of an approved subsystem
-- (callbackUrl, baseUrl, defaultRoleMapping), and the before/after values
-- of every change in the history timeline.

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "SubsystemEventAction" ADD VALUE 'CHANGE_REQUESTED';
ALTER TYPE "SubsystemEventAction" ADD VALUE 'CHANGE_APPROVED';
ALTER TYPE "SubsystemEventAction" ADD VALUE 'CHANGE_REJECTED';
ALTER TYPE "SubsystemEventAction" ADD VALUE 'CHANGE_CANCELLED';

-- AlterTable
ALTER TABLE "subsystem_events" ADD COLUMN     "changes" JSONB;

-- CreateTable
CREATE TABLE "subsystem_change_requests" (
    "id" TEXT NOT NULL,
    "subsystem_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subsystem_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subsystem_change_requests_subsystem_id_status_idx" ON "subsystem_change_requests"("subsystem_id", "status");

-- CreateIndex
CREATE INDEX "subsystem_change_requests_status_created_at_idx" ON "subsystem_change_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "subsystem_change_requests_requested_by_id_idx" ON "subsystem_change_requests"("requested_by_id");

-- CreateIndex
CREATE INDEX "subsystem_change_requests_reviewed_by_id_idx" ON "subsystem_change_requests"("reviewed_by_id");

-- AddForeignKey
ALTER TABLE "subsystem_change_requests" ADD CONSTRAINT "subsystem_change_requests_subsystem_id_fkey" FOREIGN KEY ("subsystem_id") REFERENCES "subsystems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsystem_change_requests" ADD CONSTRAINT "subsystem_change_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsystem_change_requests" ADD CONSTRAINT "subsystem_change_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
