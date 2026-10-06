# CS Canvas — Handover ให้ Claude session ถัดไป (อัปเดต 6 ต.ค. 2569)

> ไฟล์นี้อยู่นอก repo (ห้าม commit) · `CLAUDE.md` ในโฟลเดอร์นี้ import ไฟล์นี้อัตโนมัติ
> skill ที่สรุปวิธีทำงานทั้งหมด: `.claude/skills/cs-canvas-workflow/SKILL.md` (เรียกด้วย `/cs-canvas-workflow`)
> **ตอบผู้ใช้เป็นภาษาไทยเสมอ** · ผู้ใช้คือ PL ของทีม · โปรเจกต์เป็นของ AIE 1 (คุณพัทธนันท์)

## 1. จะสานต่องานยังไง (resume)

- **ต่อ session เดิม (มีบทสนทนาเต็ม):** เปิด terminal ที่ `C:\Users\User\cs-canvas` แล้ว `claude --resume 22a41021-7560-459b-bb3f-4b7e4134fd59`
  (หรือ `claude --resume` แล้วเลือกจากรายการ · บนเว็บ: https://claude.ai/code/session_015dsAvhKyRh6iBTBGtDN7bF)
- **session ใหม่ (สมองใหม่):** เปิดที่ `C:\Users\User\cs-canvas` → CLAUDE.md + ไฟล์นี้โหลดเอง → อ่านข้อ 5 "งานค้าง" แล้วทำต่อ
- transcript เก่า (ถ้าต้องค้นรายละเอียด): `C:\Users\User\.claude\projects\C--Users-User-cs-canvas\8e42add5-f598-4e13-8c11-7bffb3707792.jsonl`
  และ session ปัจจุบันในโฟลเดอร์ `22a41021-7560-459b-bb3f-4b7e4134fd59/` (ไฟล์ใหญ่มาก อย่าอ่านทั้งไฟล์ ใช้ grep)

## 2. สถานะ repo

- repo: `C:\Users\User\cs-canvas\csmju-canvas` (org repo `CSMJU2030/csmju-canvas`) · branch งาน **`feature/canvas/foundation`** (~55 commit บน `main` ที่มีแค่ scaffold)
- **ยังไม่เคย push** · Claude ห้าม push เอง → ให้ AIE 1 (บัญชี GitHub ของเพื่อน แบบเดียวกับ nexus) push + เปิด PR → PL approve → squash merge (แก้ title เป็น `feat(canvas): …`)
- มาตรฐาน: `.standards-version` = **1.8.2** (submodule ชี้ v1.8.2 · DEP-01..04 ผ่าน) · 1.8.3 ยังอยู่ใน branch (เอกสารล้วน) เลื่อนเมื่อมี tag
- ผลตรวจล่าสุด (หลัง commit `5fccd45`): frontend tsc/eslint ผ่าน · vitest 265 · backend unit 128 · e2e 29 (ฐานจริง) · run-all-checks 20/20
- **ยังไม่ได้ทดสอบในเบราว์เซอร์จริงเกือบทั้งหมด** (ไม่มีเครื่องมือเปิดเบราว์เซอร์ใน session) — PL ต้องลองกดเอง

## 3. เครื่อง dev

| ส่วน | ค่า |
|---|---|
| frontend | `http://localhost:3207` — รันด้วย PowerShell `Start-Process cmd.exe '/c cd /d …\frontend && pnpm dev > %TEMP%\canvas-frontend.log 2>&1'` |
| backend | `:4207` — `npx nest build` แล้ว `Start-Process cmd.exe '/c cd /d …\backend && node dist/main.js > %TEMP%\canvas-backend-N.log 2>&1'` (ถ้า log เดิมถูกล็อก ใช้ชื่อไฟล์ใหม่) |
| ฐานข้อมูล | Docker `csmju-canvas-postgres-1` ที่ `127.0.0.1:55207` (trust) · migration ใช้ `npx prisma migrate deploy` เท่านั้น **ห้าม reset** |
| บัญชีทดสอบ | `~/.csmju/conformance-accounts.json` · รหัสอยู่ไฟล์ private นอก repo · **ห้ามพิมพ์รหัส/อีเมลลง log/ไฟล์** · login ผิด 10 ครั้ง/15 นาทีบัญชีล็อก |
| Core Hub | `https://csmju2030.jowave.com` (python urllib ต้องใส่ User-Agent แบบเบราว์เซอร์ ไม่งั้น 403 · Node fetch ปกติ) |

## 4. สิ่งที่สร้างแล้ว (ย่อ)

ฐาน SSO 1.1 + L1–L3 · หน้าแรก/โปรเจกต์/ถังขยะ/บัญชี · editor แบบ Canva (Canvas 2D เขียนเอง) ครบ: ข้อความ รูปทรง รูป SVG เส้นวาด
**ตาราง ชาร์ต กรอบ กริด วิดีโอ เสียง** · undo/redo · snapping · layers · หน้าเดียว/เลื่อนดู/**บอร์ดแบบ Figma** · ลากข้ามหน้า · ซูมนุ่ม ·
แชร์ลิงก์ (ดู/คอมเมนต์/แก้) · ความคิดเห็น · ประวัติเวอร์ชัน · พรีเซนต์ + หน้าต่างผู้พรีเซนต์ + Magic · ตัวจับเวลา · โน้ต ·
ดาวน์โหลด PNG/JPG/PDF/SVG/GIF/วิดีโอ/PPTX · คลังกราฟิก Tabler/Noto/CC0 · ฟอนต์ ~107 ตระกูล + อัปโหลดฟอนต์เอง ·
ฟิลเตอร์ 55 · เอฟเฟกต์ภาพ 20 · Levels/Curves · blend mode · สไตล์ภาพ · ลบพื้นหลัง (สี ไม่ใช้ AI) · ยางลบพิกเซล · แก้ไขสี ·
ลากวาง/วางไฟล์ทุกทาง (Ctrl+V จาก Pinterest ใช้ได้ — PL ทดสอบแล้ว) · แหล่งภาพ (Pinterest อันดับแรก) แผงลอย + ถาดรับภาพ PiP ·
**แผงผู้ดูแล `/admin`** (staff/admin): ภาพรวม สมาชิก+ปรับโควตา กิจกรรม เรื่องร้องเรียน งานที่ถูกลบ (เก็บ 30 วัน) Audit log
JSON ของงาน (สัญญากับ CMS): `docs/design-document.md`

## 5. งานค้าง (เรียงตามที่ PL สั่งล่าสุด)

1. ~~เตรียม deploy~~ **เสร็จ** (`b9da235`, `10c6b72`): Dockerfile ทั้งสอง · entrypoint · `.dockerignore` · `docker-compose.yml` ที่ราก (db+api+web แบบล็อกเหมือน server, web ที่ 127.0.0.1:3207) · standalone · `DATABASE_POOL_MAX` · `.gitattributes` ให้ .sh/Dockerfile เป็น LF
   - **ทดสอบ Docker ในเครื่องผ่านแล้ว** (6 ต.ค.): build ทั้งสอง image (web 390 MB · api 848 MB) · migration 10 ตัวลงฐาน Postgres 16 ใหม่ · ระบบไฟล์อ่านอย่างเดียวไม่มี error · `/auth/login` → Core Hub · token ของเบราว์เซอร์จริงผ่าน · seed เทมเพลตด้วย `docker compose exec api node dist/scripts/seed-templates.js` ได้ 8 ชิ้น · README มีหัวข้อ Deploy สำหรับ DevOps (`5fccd45`)
2. ~~ไฟล์อัปโหลดเข้าฐาน~~ **เสร็จ** (`90e02fa`): ตาราง `asset_contents` (bytea) + `assets.sha256` · ทุกชนิด ≤ 10 MB (ฟอนต์ 5 MB) · 400 VALIDATION_ERROR · ETag + `private, no-cache` · ไฟล์เดิม 31 ไฟล์ย้ายด้วย `pnpm --filter backend assets:import-disk` แล้ว
   - **ข้อควรรู้:** ส่ง `Buffer` ให้ Prisma ตรง ๆ — ถ้าแปลงเป็น `new Uint8Array(...)` 10 MB ใช้ ~30 วินาที (เจอจริง)
   - PL ต้องแจ้ง DevOps ปริมาณไฟล์รวมที่คาด (เกิน 1 GB ต้องตกลง · deployment.md ข้อ 4.3)
3. รัน conformance (`CONFORMANCE_ACCOUNTS_FILE=$HOME/.csmju/conformance-accounts.json node standards/conformance/run.js` ต้อง 0 failed 0 skipped) · ทำ `REPORT.md` ตาม `standards/ai/AGENTS.md` ข้อ 6
4. **รอบ 2 (ทำเองใน session — การสร้าง agent ถูกระบบตรวจสิทธิ์ของ Claude Code ปฏิเสธ "Auto-Mode Bypass" อย่าพยายามเลี่ยง):**
   - คีย์ลัดมาตรฐานครบ (Ctrl+X cut ยังไม่มี, Ctrl+Shift+V, nudge, group …) + toast เล็กมุมขวาบอกว่าทำอะไร + หน้ารวมคีย์ลัด (`use-shortcuts.ts`)
   - อนิเมชันเพิ่ม (entry/emphasis/exit/page transition/motion path) + **GIF เคลื่อนไหวในหน้า** (ต้องเขียนตัวถอด GIF เอง)
   - เคอร์เซอร์เพื่อนพร้อมชื่อแบบเรียลไทม์ (socket.io อยู่ใน whitelist · ลอกแบบ nexus: ตั๋ว REST + ต่อ socket ตรง) — **บน server api ไม่เปิดออกนอก ต้องให้ DevOps เปิดเส้นทาง WebSocket ก่อน**
   - ศูนย์เครื่องมือ ~100 ชิ้น + Brand Kit + Styles + QR (`qrcode.react` อยู่ใน whitelist) + ตัวสร้างลาย/ปฏิทิน ฯลฯ
5. ย้ายภาพบรีฟที่ทำเสร็จจาก `csmju-canvas/Current Brief` → `Complete Brief` ชื่อสั้น `<คำอธิบาย> (เสร็จ YYYY-MM-DD HH.MM น.).png` (สองโฟลเดอร์นี้ถูก exclude จาก git)
6. แนะนำ PL ลบโฟลเดอร์ `csmju-core-hub-feature-…` (กฎ PM: repo Core Hub มีข้อมูลนักศึกษาจริง ห้ามเก็บ) — อย่าเปิดอ่านข้อมูลข้างใน

## 6. การตัดสินใจของ PL ที่ต้องจำ

- ไม่มี AI/LLM ทุกจุด (ผู้ช่วยค้นหาในระบบไม่ใช้ LLM) · ลบพื้นหลังแบบสีแทน AI · Magic/AI ทำไม่ได้จนกว่าจะขอข้อยกเว้น
- Pinterest/Google: **ไม่ดึงผ่าน API/ไม่ฝัง iframe/ไม่ scrape** → ทางลัดเปิดข้างจอ + คัดลอกวาง + ถาดรับภาพ + เตือนลิขสิทธิ์
- งานที่ลบถาวรเก็บให้ admin 30 วัน · admin ปรับโควตาได้ (สูงสุด 5 GB) · แผงผู้ดูแลเปิดได้เฉพาะ core role staff/admin
- ห้ามเก็บ core role ชื่อ อีเมลลงฐาน (data-dictionary) · audit_logs เก็บ role ผู้กระทำ ณ เวลานั้นได้ (แบบ nexus)
- "ทดลองใช้ฟรี 30 วัน" ของ Canva เปลี่ยนเป็นพื้นที่คงเหลือ · ไม่มีระบบจ่ายเงิน · ฟีเจอร์ Pro ของ Canva ที่ไม่ใช้ AI ทำให้ฟรีได้
- ไฟล์อัปโหลดบน server เก็บในฐานข้อมูล ไฟล์ละ ≤ 10 MB
