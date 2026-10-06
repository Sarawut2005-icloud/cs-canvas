# CS Canvas (csmju-canvas) · AIE 1

@PM-STANDARDS.md
@NEXUS-PLAYBOOK.md
@BRIEF-SUMMARY.md
@HANDOVER.md

> **session ใหม่เริ่มที่นี่:** อ่าน `HANDOVER.md` (สถานะล่าสุด + งานค้าง) และใช้ skill `/cs-canvas-workflow` (วิธีทำงาน คำสั่งตรวจ กับดักที่เจอจริง)

> **สถานะ:** cs-nexus เสร็จแล้ว (4 ต.ค. 2569) · **PL สั่งเริ่มโปรเจกต์นี้แล้ว** · อ่าน `BRIEF-SUMMARY.md` ก่อนลงมือ (มีการตัดสินใจของ PL และบทเรียนจาก nexus)
> **ต้นแบบ:** csmju-nexus ที่ผ่านแล้ว · ทำตามขั้นใน `NEXUS-PLAYBOOK.md` · ดูโค้ดได้ที่ `C:\Users\User\nexus-dev` หรือ github.com/CSMJU2030/csmju-nexus
> **ผู้ใช้:** PL ของทีม · **ตอบเป็นภาษาไทยเสมอ** · ห้ามใช้ข้อมูลปลอม · ห้ามมีปุ่มที่กดแล้วไม่ทำอะไร · ทุกอย่างต้องฟรี

## ข้อมูลระบบจาก PM

| รายการ | ค่า |
|---|---|
| repo | `github.com/CSMJU2030/csmju-canvas` (org repo ที่ DevOps สร้างไว้แล้ว) |
| `SUBSYSTEM_ID` / ชื่อในทะเบียน | `csmju-canvas` |
| พอร์ต | frontend **3207** · backend **4207** |
| callback | `http://localhost:3207/auth/callback` |
| Core Hub | `https://csmju2030.jowave.com` |
| บัญชีเจ้าของระบบ | `admin` (role staff) ของทีม csmju-canvas · รหัสผ่านอยู่ในไฟล์ `dev-server-accounts.private` ที่ PL เก็บไว้นอก repo · **ห้ามคัดลอกรหัสลงไฟล์ใดใน repo** |

## บรีฟ (จาก AIE 1 · นายพัทธนันท์ ปันตุ้ย)

**CS Canvas** คือระบบสร้างสื่อและกราฟิกแบบ Canva บนเว็บ
- **นักศึกษา** ทำสไลด์ ปกรายงาน อินโฟกราฟิก โปสเตอร์ และ Resume
- **อาจารย์และบุคลากร** ทำสื่อการสอน ภาพประชาสัมพันธ์ และเกียรติบัตร
- **ผู้ดูแลระบบและนักพัฒนา CMS** ดึง JSON ของงานไปแสดงเป็น Dynamic Graphic Block บนเว็บคณะ

ฟีเจอร์:
1. ผืนผ้าใบ 2D (Text / Shape / SVG / Image) ลาก หมุน และย่อขยายได้ลื่น 60 FPS
2. ลบพื้นหลังรูปด้วย AI ที่รันในเบราว์เซอร์ (WASM)
3. Snapping และ guide สำหรับจัดวาง · จัดการ layer (ยกขึ้น/ลง จัดกลุ่ม ล็อก)
4. คลังภาพ ไอคอน และฟอนต์
5. บันทึกงานเป็น JSON state เพื่อให้ CMS นำไป render สด
6. ส่งออกเป็น PNG (พื้นหลังโปร่งใส) / JPEG / Vector PDF
7. หน้าจอแก้ไขที่รองรับ desktop, tablet และมือถือ (มือถือมีแผงเครื่องมือเลื่อนขึ้นจากล่าง)

## ⚠️ จุดที่บรีฟขัดกับมาตรฐาน PM (ต้องให้ PL ตัดสินก่อนลงมือ)

| ในบรีฟ | มาตรฐาน | ทางที่แนะนำ |
|---|---|---|
| Next.js 14/15 | ใช้ตามเวอร์ชัน demo และ nexus (Next 16) | ใช้ stack เดียวกับ nexus |
| Fabric.js / Konva.js | ไม่อยู่ใน whitelist (`ARC-02`) | **ขอข้อยกเว้น** ARC-02 สำหรับ `fabric` หรือ `konva` (ตัวเดียว) หรือเขียน engine เองบน HTML5 Canvas/SVG |
| `@imgly/background-removal-browser` | ไม่อยู่ใน whitelist · ตัวโมเดลโหลดจาก CDN ภายนอก | ขอข้อยกเว้น และตรวจ license กับ URL ที่โหลดโมเดล · ถ้าไม่ได้ให้ตัดฟีเจอร์นี้ |
| Zustand | ✅ อยู่ใน whitelist | ใช้ได้ |
| Redis | ไม่อยู่ใน whitelist (backend) | เริ่มด้วย PostgreSQL ก่อน · ถ้าจำเป็นจริงค่อยขอข้อยกเว้น |
| MinIO / S3 | ไม่อยู่ใน whitelist | เก็บไฟล์บนดิสก์ด้วย signed URL แบบที่ nexus ทำ (`assets` module) |
| Sharp + pdf-lib | ไม่อยู่ใน whitelist (sharp อนุญาตเฉพาะ Core Hub) | export ฝั่ง client ด้วย Canvas API · ถ้าต้องใช้ PDF แบบ vector ให้ขอข้อยกเว้น `pdf-lib` |
| Unsplash / Pixabay / Iconify / Google Fonts API | เป็นบริการภายนอก ต้องใช้ API key · ห้ามใช้ `next/font/google` · ห้ามส่งข้อมูลผู้ใช้ออกนอกระบบ | ตัดออก หรือขอข้อยกเว้นทีละบริการ · ไอคอนใช้ `lucide-react` (อยู่ใน whitelist) · ฟอนต์ใช้ของ design system |
| UI ของ editor | ต้องอยู่ใน `<CsmjuAppShell>` · ใช้สีจาก token | ตัวผืนผ้าใบนับเป็น "จุดอิสระ" แต่แถบเครื่องมือ ฟอร์ม และเมนูต้องใช้ DS |

## ลำดับเริ่มงาน (เมื่อ PL สั่งเริ่ม)

1. clone `CSMJU2030/csmju-canvas` แล้วรัน `git submodule update --init standards/` · ตรวจว่า `.standards-version` เป็น 1.7.1 (ถ้ายังเป็น 1.7.0 ทำ PR bump ก่อน)
2. `curl https://csmju2030.jowave.com/api/v1/health` ต้องได้ 200
3. คัดลอกชั้น auth และ common จาก demo หรือจาก nexus (`backend/src/auth`, `backend/src/common`) แล้วเปลี่ยนชื่อคุกกี้เป็น `csmju_canvas_*`
4. ใช้ frontend จาก `design-system/examples/subsystem-template/frontend/`
5. ให้ PL ลงทะเบียนที่ backoffice ด้วย callback `http://localhost:3207/auth/callback`
6. ทำ L1 → L2 → L3 ให้ conformance ได้ 0/0 ก่อน แล้วจึงเริ่มทำ editor
