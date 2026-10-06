-- CreateEnum
CREATE TYPE "SubsystemCategory" AS ENUM ('LEARNING', 'CODING', 'CAREER_ACTIVITY', 'COMMUNITY', 'STUDENT_SERVICE', 'TOOLS', 'OTHER');

-- AlterTable
ALTER TABLE "subsystems" ADD COLUMN     "category" "SubsystemCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "listed_in_menu" BOOLEAN NOT NULL DEFAULT true;


-- Initial categories for the subsystems registered on the server before this
-- (PM 2026-10-05). Matched by name: a database without them changes nothing,
-- and admins or owners can change any of them afterwards in the backoffice.
UPDATE "subsystems" SET "category" = 'LEARNING'
  WHERE "name" IN ('csmju-canvas', 'csmju-attendance-checker', 'csmju-quiz', 'csmju-study-qa');
UPDATE "subsystems" SET "category" = 'CODING'
  WHERE "name" IN ('csmju-coding-arena', 'csmju-gamification-knowledge');
UPDATE "subsystems" SET "category" = 'CAREER_ACTIVITY'
  WHERE "name" IN ('csmju-internship-directory', 'csmju-coop-hours-calculator', 'csmju-department-activity-planner');
UPDATE "subsystems" SET "category" = 'COMMUNITY'
  WHERE "name" IN ('csmju-nexus');
UPDATE "subsystems" SET "category" = 'STUDENT_SERVICE'
  WHERE "name" IN ('csmju-scholarship', 'csmju-maintenance-request', 'csmju-interactive-map', 'csmju-shop');
UPDATE "subsystems" SET "category" = 'TOOLS'
  WHERE "name" IN ('csmju-toolboxes', 'csmju-cloudflow');

-- The reference implementation teams test SSO against — not for users.
UPDATE "subsystems" SET "listed_in_menu" = false WHERE "name" = 'csmju-demo-subsystem';
