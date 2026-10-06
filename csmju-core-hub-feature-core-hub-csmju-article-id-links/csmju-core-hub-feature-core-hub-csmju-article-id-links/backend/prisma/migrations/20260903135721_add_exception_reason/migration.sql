/*
  Warnings:

  - Added the required column `reason` to the `subsystem_exceptions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "subsystem_exceptions"
ADD COLUMN "reason" TEXT;

UPDATE "subsystem_exceptions"
SET "reason" = 'Legacy exception request';

ALTER TABLE "subsystem_exceptions"
ALTER COLUMN "reason" SET NOT NULL;
