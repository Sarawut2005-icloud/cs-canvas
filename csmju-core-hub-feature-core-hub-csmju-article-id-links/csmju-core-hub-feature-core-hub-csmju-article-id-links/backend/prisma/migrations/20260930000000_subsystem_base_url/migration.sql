-- ที่อยู่ของระบบย่อยสำหรับ Monitor (backoffice เฟส 2) — ว่างได้ ระบบที่ไม่มีจะแสดง NO_BASE_URL
-- AlterTable
ALTER TABLE "subsystems" ADD COLUMN     "base_url" TEXT;
