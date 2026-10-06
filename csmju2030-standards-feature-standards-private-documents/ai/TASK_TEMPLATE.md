# TASK_TEMPLATE.md — เทมเพลตสั่งงาน AI

คัดลอกทั้งบล็อก เติมช่องว่าง แล้วส่งให้ AI agent ตัวไหนก็ได้

---

```text
งาน: พัฒนาระบบย่อย CSMJU2030 ชื่อ "<subsystem-name>" (<ชื่อภาษาไทย>)

เอกสารที่ต้องอ่านให้ครบก่อนเริ่ม (ห้ามข้าม):
- standards/docs/overview.md            ← เริ่มที่นี่ แล้วตามลิงก์ที่มันชี้
- standards/ai/AGENTS.md                ← กติกาการทำงานของคุณ
- standards/contracts/*.json            ← สัญญาที่เป็นข้อมูล
- demo-student-subsystem/backend/       ← reference implementation ที่ให้คัดลอกชั้น auth

ขอบเขตงาน (business domain):
- entity: <เช่น Equipment, BorrowRecord, Category>
- ความสามารถ: <เช่น ยืม-คืนครุภัณฑ์ · ตรวจสถานะ · ประวัติการยืม>
- กฎธุรกิจอย่างน้อย 3 ข้อ:
  1. <…>
  2. <…>
  3. <…>

การแมป role (ต้องประกาศค่าเดียวกันนี้ใน Subsystem Registry · role ที่ไม่ใส่ = เข้าไม่ได้):
- student  → <USER>
- alumni   → <ไม่ให้เข้า / ระบุ role>
- staff    → <STAFF>          (เจ้าหน้าที่ที่ไม่ใช่อาจารย์)
- lecturer → <TEACHER>
- guest    → <ไม่ให้เข้า / ระบุ role>
- admin    → <ADMIN>

สภาพแวดล้อม:
- Core Hub: https://csmju2030.jowave.com  (อ่านจาก env CORE_HUB_URL / CORE_HUB_WEB_URL — ห้ามเขียนตายในโค้ด)
- ระบบย่อยนี้: frontend http://localhost:<32xx> · backend http://127.0.0.1:<42xx>
- ฐานข้อมูลของตัวเอง: <subsystem>_db   (ห้ามต่อ core_hub)
- ข้อมูลกลาง: เรียกจาก Core Hub ตาม standards/docs/reference-data.md — เก็บแค่ code / core_user_id / person_code

เกณฑ์รับงาน:
1. ./standards/scripts/run-all-checks.sh .   →  เขียวทุกข้อ
2. node standards/conformance/run.js         →  0 failed, 0 skipped ที่ระดับ L3 (บัญชีจากไฟล์นอก repo)
3. ส่ง REPORT.md ตามรูปแบบใน standards/ai/AGENTS.md ข้อ 6

ข้อห้าม (ดู auth-contract.md ข้อ 9):
- ห้ามสร้างระบบ login/password ของตัวเอง
- ห้ามแก้ไฟล์ใน standards/
- ห้ามใช้ npm/yarn (ใช้ pnpm) และห้ามใช้ jsonwebtoken/passport-jwt (ใช้ jose)
- ห้ามรายงานว่าเสร็จถ้ายังมีเคส fail หรือ skip

เริ่มจาก: อ่านเอกสารทั้งหมด → สรุปแผนสั้น ๆ ให้ฉันดูก่อน 1 ครั้ง → แล้วค่อยลงมือ
```

---

## เคล็ดลับให้ผลจากหลายโมเดลตรงกัน

| ทำ | ผล |
|---|---|
| แนบเอกสารเป็นไฟล์จริง ไม่ใช่สรุปย่อ | ลดการเดาของโมเดล |
| ระบุระดับเป้าหมายชัด (L1/L2/L3) | โมเดลรู้ว่าต้องหยุดตรงไหน |
| บังคับให้รัน conformance และแปะผลจริง | ปิดช่องว่าง "คิดว่าเสร็จแล้ว" |
| ให้เขียน REPORT.md พร้อมข้อสมมติ | เห็นจุดที่แต่ละโมเดลตีความต่างกัน แล้วเอาไปเติมในมาตรฐานรอบหน้า |
| ห้ามแตะ `standards/` | กันโมเดลแก้เกณฑ์แทนแก้โค้ด |
