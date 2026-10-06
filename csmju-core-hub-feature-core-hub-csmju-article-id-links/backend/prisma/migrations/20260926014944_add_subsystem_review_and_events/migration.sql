-- CreateEnum
CREATE TYPE "SubsystemEventAction" AS ENUM ('SUBMITTED', 'UPDATED', 'APPROVED', 'REJECTED', 'RESUBMITTED', 'ACTIVATED', 'DEACTIVATED', 'SUSPENDED', 'EXCEPTION_REQUESTED', 'EXCEPTION_APPROVED', 'EXCEPTION_REJECTED');

-- AlterTable
ALTER TABLE "subsystems" ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" TEXT,
ADD COLUMN     "status_reason" TEXT;

-- CreateTable
CREATE TABLE "subsystem_events" (
    "id" TEXT NOT NULL,
    "subsystem_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "SubsystemEventAction" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subsystem_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subsystem_events_subsystem_id_created_at_idx" ON "subsystem_events"("subsystem_id", "created_at");

-- CreateIndex
CREATE INDEX "subsystem_events_actor_id_idx" ON "subsystem_events"("actor_id");

-- AddForeignKey
ALTER TABLE "subsystems" ADD CONSTRAINT "subsystems_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsystem_events" ADD CONSTRAINT "subsystem_events_subsystem_id_fkey" FOREIGN KEY ("subsystem_id") REFERENCES "subsystems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsystem_events" ADD CONSTRAINT "subsystem_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
