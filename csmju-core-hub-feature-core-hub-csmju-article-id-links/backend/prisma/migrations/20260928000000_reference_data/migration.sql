-- master-data v0.7: รูปแบบ Reference Data ตามสเปกของ PM (SHARED_DATA_HANDOFF.md)
-- ไม่แตะตารางเดิมของ Core Hub (users, sessions, roles, permissions, subsystems, ...)

-- 1) ประเภทห้องตามสเปก: CLASSROOM → LECTURE, OTHER → LECTURE (ข้อมูลเดิมมีแค่ CLASSROOM กับ LAB)
BEGIN;
CREATE TYPE "RoomType_new" AS ENUM ('LECTURE', 'LAB', 'SEMINAR', 'MEETING', 'PROJECT', 'OFFICE');
ALTER TABLE "rooms" ALTER COLUMN "room_type" TYPE "RoomType_new"
  USING (CASE "room_type"::text WHEN 'CLASSROOM' THEN 'LECTURE' WHEN 'OTHER' THEN 'LECTURE' ELSE "room_type"::text END)::"RoomType_new";
ALTER TYPE "RoomType" RENAME TO "RoomType_old";
ALTER TYPE "RoomType_new" RENAME TO "RoomType";
DROP TYPE "RoomType_old";
COMMIT;

-- 2) รหัสตามกฎสเปก ^[A-Z0-9-]+$ — ต้องเปลี่ยนตอนนี้ ก่อนระบบย่อยเริ่มเก็บรหัส (สเปก D5 ห้ามแก้หลังจากนั้น)
UPDATE "faculties" SET "code" = 'SCI', "updated_at" = now() WHERE "code" = 'science';
UPDATE "buildings" SET "code" = upper("code"), "updated_at" = now() WHERE "code" <> upper("code");
UPDATE "rooms"     SET "code" = upper("code"), "updated_at" = now() WHERE "code" <> upper("code");

-- 3) ภาคการศึกษา: ปิดใช้งานแทนการลบ (สเปก D6)
ALTER TABLE "terms" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- 4) ห้องอ้างอิงคณะด้วย code
ALTER TABLE "rooms" ADD COLUMN     "faculty_code" TEXT;
UPDATE "rooms" SET "faculty_code" = 'SCI' WHERE "faculty_code" IS NULL AND EXISTS (SELECT 1 FROM "faculties" WHERE "code" = 'SCI');

CREATE INDEX "rooms_faculty_code_idx" ON "rooms"("faculty_code");
CREATE INDEX "rooms_is_active_idx" ON "rooms"("is_active");
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_faculty_code_fkey" FOREIGN KEY ("faculty_code") REFERENCES "faculties"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) กฎรูปแบบ code (สเปก 4.1) — Prisma ไม่ติดตาม CHECK จึงไม่เกิด drift
ALTER TABLE "faculties" ADD CONSTRAINT "faculties_code_format_chk" CHECK ("code" ~ '^[A-Z0-9-]+$');
ALTER TABLE "rooms"     ADD CONSTRAINT "rooms_code_format_chk"     CHECK ("code" ~ '^[A-Z0-9-]+$');
ALTER TABLE "terms"     ADD CONSTRAINT "terms_code_format_chk"     CHECK ("code" ~ '^[0-9]{4}-[1-3]$');
