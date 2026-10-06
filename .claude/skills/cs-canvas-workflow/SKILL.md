---
name: cs-canvas-workflow
description: วิธีทำงานกับโปรเจกต์ CS Canvas (csmju-canvas) ที่ผ่านมาทั้งหมด — สถานะ งานค้าง คำสั่งตรวจ การรันเซิร์ฟเวอร์ การรวมงาน กับดักที่เจอจริง ใช้เมื่อสานต่องาน CS Canvas หรือเริ่ม session ใหม่ในโฟลเดอร์ cs-canvas
---

# CS Canvas workflow (สรุปจากการทำงานจริงกับ PL)

อ่าน `C:\Users\User\cs-canvas\HANDOVER.md` ก่อนเสมอ (สถานะล่าสุด + งานค้าง + การตัดสินใจของ PL) แล้วทำตามนี้

## กฎที่ห้ามพลาด
- ตอบภาษาไทย · ห้ามข้อมูลปลอม · ห้ามปุ่มที่กดแล้วไม่ทำอะไร · ทุกอย่างฟรี · ไม่มี AI/LLM · ไม่เรียก API ภายนอกที่ต้องมี key · ไม่ส่งข้อมูลผู้ใช้ออกนอกระบบ
- **ห้าม push** (AIE 1 push เอง) · ห้ามแก้ `standards/` `.github/` `backend/src/auth/` · ห้าม `prisma migrate reset`
- dependency ต้องอยู่ใน `standards/scripts/lib/allowed-deps.json` (ARC-02) · ห้าม hex ดิบใน frontend ทั้งไฟล์ .ts/.tsx/.css แม้ในข้อความหรือคอมเมนต์ (UI-01 regex `#[0-9a-fA-F]{3,8}\b`) — ใช้ `rgb()` และ token class
- ห้ามเก็บ core role ชื่อ อีเมลลงฐาน · อ้างผู้ใช้ด้วย `coreUserId` เท่านั้น
- บัญชีทดสอบอยู่ `~/.csmju/` ล็อกอินบัญชีละครั้ง ห้ามพิมพ์รหัส/อีเมล
- ถ้าเครื่องมือ/การสร้าง agent ถูกระบบตรวจสิทธิ์ปฏิเสธ อย่าเลี่ยง — บอก PL ให้ตัดสิน

## คำสั่งตรวจ (ต้องผ่านก่อนรายงานว่าเสร็จ)
```bash
cd C:/Users/User/cs-canvas/csmju-canvas/frontend && npx tsc --noEmit -p . && npx eslint src && CI=true npx vitest run
cd ../backend && npx tsc --noEmit -p . && npx eslint src test && npx vitest run
npx vitest run --config ./vitest.config.e2e.ts      # ใช้ฐานจริง 55207
npx nest build && pnpm openapi                       # แก้ endpoint แล้วต้อง commit openapi.json
cd .. && bash standards/scripts/run-all-checks.sh .  # ต้อง 19/19
```
- `run-all-checks` สแกนโฟลเดอร์ `.claude/worktrees` ด้วย → ลบ worktree ที่รวมแล้วก่อนรัน (ใช้ PowerShell `Remove-Item -LiteralPath '\\?\<path>' -Recurse -Force` เพราะ path ใน node_modules ยาวเกิน แล้ว `git worktree prune`)
- `backend/openapi.json` มักเปลี่ยนแค่ line ending หลังรันตรวจ → ถ้า `git diff` ไม่มีบรรทัด `+`/`-` ให้ `git checkout -- backend/openapi.json`

## migration
- สร้าง SQL โดยไม่แตะฐาน: `git show HEAD:backend/prisma/schema.prisma > %TEMP%\old.prisma` แล้ว
  `npx prisma migrate diff --from-schema %TEMP%\old.prisma --to-schema prisma/schema.prisma --script 2>/dev/null | sed -n '/^-- /,$p' > prisma/migrations/<YYYYMMDDHHMMSS>_<ชื่อ>/migration.sql`
- จากนั้น `npx prisma migrate deploy` และ `npx prisma generate` · migration ที่ deploy แล้วห้ามแก้
- relation ย้อนกลับที่ชื่อ camelCase ต้องมี `@relation("ชื่อ")` ทั้งสองฝั่ง (DD-03)

## เซิร์ฟเวอร์ dev (Windows)
- process ที่รันค้างต้องใช้ PowerShell `Start-Process` (Bash background ถูก kill) · หยุดด้วย `Get-NetTCPConnection -LocalPort 4207 -State Listen` → `Stop-Process`
- แก้ backend แล้ว: `npx nest build` → รีสตาร์ท `node dist/main.js` · frontend dev (`pnpm dev`) hot reload เอง (เปลี่ยน dependency แล้วต้องรีสตาร์ท)
- ตรวจหน้า: python urllib GET `http://localhost:3207/design/00000000-0000-4000-8000-000000000000` ต้อง 200 · curl ถูก hook บล็อก ใช้ python หรือ PowerShell `Invoke-WebRequest`

## กับดักที่เจอจริง
- ไฟล์ส่วนใหญ่เป็น **CRLF** — สคริปต์แทนข้อความต้องรองรับ `\r\n` (ใช้ helper ที่แปลง `\n` เป็น newline ของไฟล์) · conflict marker ก็เป็น CRLF
- python ใน heredoc: `\n` ในสตริง Python กลายเป็น newline จริงในไฟล์ TS → ใช้ Edit หรือเขียนสคริปต์เป็นไฟล์แล้วใช้ `chr(92)`
- bash heredoc ที่มี `'` ซ้อนกันอาจพัง → เขียนสคริปต์ลงไฟล์ด้วย Write ก่อน
- React compiler lint: ห้าม setState ใน effect ตรง ๆ · ห้ามอ่าน ref ระหว่าง render · destructure ผลของ `useAnchoredMenu()` · useCallback อ้างตัวเองไม่ได้
- token สี `inverse` กลับด้านในธีมมืด → เวทีพรีเซนต์ใช้ class `.csmju-stage` ล็อกสี
- หน้าต่างผู้พรีเซนต์/PiP เป็นเอกสารแยก: ต้องคัดลอก stylesheet, ใช้ timer/ResizeObserver ของหน้าต่างนั้น, ติดตั้งฟอนต์ด้วย `mirrorFonts`
- Agent/worktree: ต้องอยู่ในโฟลเดอร์ repo (`csmju-canvas`) ก่อนสร้าง ไม่งั้น "Failed to resolve base branch HEAD" · worktree ของ agent มักเริ่มจาก `main` ต้อง `git reset --hard feature/canvas/foundation` · โควตาหมดกลางทาง → SendMessage ให้ทำต่อ · รวมงานแล้วรันตรวจทั้งชุดเอง
- บน server (มาตรฐาน 1.8) ระบบไฟล์ container อ่านอย่างเดียว: ห้ามเขียนไฟล์ตอนบูต (แก้ `main.ts` แล้ว) และห้ามเก็บไฟล์อัปโหลดลงดิสก์

## โฟลเดอร์บรีฟ
- `csmju-canvas/Current Brief` = งานที่ต้องทำ · เสร็จแล้วย้ายไป `Complete Brief` ชื่อสั้น `<คำอธิบาย> (เสร็จ YYYY-MM-DD HH.MM น.).png` · ภาพที่ทำไม่ได้ (AI, แอปภายนอก, กล้อง/ไมค์, ลิงก์สาธารณะ) คงไว้และอธิบายเหตุผล

## รูปแบบ commit
`feat|fix|chore|docs|test|refactor(canvas): …` ท้ายข้อความ:
```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015dsAvhKyRh6iBTBGtDN7bF
```
