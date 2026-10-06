-- ให้ทุก connection ของฐานข้อมูลนี้ใช้เขตเวลา UTC
--
-- เหตุผล: @prisma/adapter-pg อ่านคอลัมน์ timestamptz ผิดเมื่อ session ไม่ได้เป็น UTC
-- (เช่น PostgreSQL บน Windows ที่ติดตั้งด้วยเขตเวลา Asia/Bangkok) เวลาจะคลาดไป 7 ชั่วโมง
-- ค่าที่เก็บในฐานข้อมูลไม่เปลี่ยน — เปลี่ยนแค่วิธีที่ connection ใหม่อ่าน/เขียน
-- ตารางเดิมของ Core Hub ใช้ timestamp without time zone ที่ Prisma เขียนเป็น UTC อยู่แล้ว จึงไม่กระทบ
-- มีผลกับ connection ที่เปิดใหม่หลังจากนี้ (ต้อง restart Core Hub)
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END
$$;
