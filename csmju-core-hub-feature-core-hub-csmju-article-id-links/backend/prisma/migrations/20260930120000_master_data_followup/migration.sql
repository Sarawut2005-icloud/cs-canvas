-- ตามแก้ master-data ที่เข้า develop ทาง #17 (guidebook/MASTER_DATA_FOLLOWUP_HANDOFF.md F2 F6 F7 F8)
--
-- migration ตามหลัง ไม่แก้ migration เดิม เพราะอยู่บน develop แล้ว (และเคยขึ้น main)
-- ชื่อต้องเรียงหลัง 20260930000000_subsystem_base_url เพราะ develop ใช้ชื่อวันที่อนาคตไปแล้ว
--
-- 1. ลบตาราง enrollments — การลงทะเบียนเรียนเป็นข้อมูลของระบบวิชาการ (SHARED_DATA ข้อ 2)
-- 2. เปลี่ยนสิทธิ์ master-data:read → people:me:read โดยคงการผูกกับ role ไว้
-- 3. เปลี่ยนรหัสภาควิชา computer-science → CS ให้ตรงกติกา code ^[A-Z0-9-]+$

-- 1) หยุดถ้ามีข้อมูลการลงทะเบียน — ตารางนี้ไม่เคยมีข้อมูลจาก seed หรือ master-data.sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "enrollments") THEN
    RAISE EXCEPTION 'enrollments has rows — stop and ask the PL before dropping it';
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_section_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_student_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_verified_by_id_fkey";

-- DropTable
DROP TABLE "enrollments";

-- DropEnum
DROP TYPE "DataSource";

-- DropEnum
DROP TYPE "EnrollmentStatus";

-- 2) เปลี่ยนชื่อสิทธิ์ — role_permissions ตามไปเองด้วย ON UPDATE CASCADE
--    ถ้าฐานนี้มี people:me:read อยู่แล้ว (เคยรัน seed ของ master-data-v2) ให้ย้ายการผูก role มาที่ตัวนั้นแล้วลบตัวเก่า
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "permissions" WHERE "id" = 'permission-people-me-read') THEN
    INSERT INTO "role_permissions" ("role_id", "permission_id")
    SELECT "role_id", 'permission-people-me-read'
    FROM "role_permissions"
    WHERE "permission_id" = 'permission-master-data-read'
    ON CONFLICT DO NOTHING;
    DELETE FROM "permissions" WHERE "id" = 'permission-master-data-read';
  ELSE
    UPDATE "permissions"
    SET "id" = 'permission-people-me-read',
        "name" = 'people:me:read',
        "description" = 'Read own person profile (/people/me)',
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = 'permission-master-data-read';
  END IF;
END $$;

-- 3) รหัสภาคใหม่ — ถ้ามีทั้งสองรหัสอยู่แล้ว (โหลด SQL ทั้งสองฉบับ) ให้หยุด เพราะต้องย้ายข้อมูลที่อ้างถึงด้วยมือ
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "departments" WHERE "code" = 'computer-science')
     AND EXISTS (SELECT 1 FROM "departments" WHERE "code" = 'CS') THEN
    RAISE EXCEPTION 'departments has both computer-science and CS — merge them by hand, then rerun';
  END IF;
  UPDATE "departments"
  SET "code" = 'CS', "updated_at" = CURRENT_TIMESTAMP
  WHERE "code" = 'computer-science';
END $$;
