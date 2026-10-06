# CHECKLIST — ส่งงานระบบย่อย CSMJU2030

ใช้เป็นแบบฟอร์มส่งงานและแบบฟอร์มรีวิว · ติ๊กได้เมื่อ **มีหลักฐาน** เท่านั้น

## ก่อนเริ่มเขียนโค้ด

- [ ] อ่าน `standards/docs/overview.md` และเอกสารที่มันชี้ครบ
- [ ] อ่าน `standards/ai/AGENTS.md` (ถ้าใช้ AI ช่วยเขียน)
- [ ] ต่อ Core Hub จริงได้ (`curl https://csmju2030.jowave.com/api/v1/health` → 200) · อ่าน `standards/docs/connect-core-hub.md` แล้ว
- [ ] ตกลงระดับเป้าหมายกับ PL (L1 / L2 / L3)

## Tech stack (tech-stack.md ข้อ 1)

- [ ] Node 22 · NestJS ^11 · TypeScript ^5.9
- [ ] `prisma` / `@prisma/client` / `@prisma/adapter-pg` = **7.9.1 เป๊ะทั้งสามตัว**
- [ ] PostgreSQL 16+ · ฐานข้อมูลของตัวเอง (ไม่ใช่ `core_hub`)
- [ ] ตรวจ JWT ด้วย `jose` (ไม่ใช่ jsonwebtoken/passport-jwt)
- [ ] **pnpm** — มี `pnpm-lock.yaml` และ `pnpm-workspace.yaml` · ไม่มี `package-lock.json`
- [ ] frontend (ถ้ามี) เป็น Next.js และไม่มี login ของตัวเอง

## ทะเบียนกับ Core Hub

- [ ] ลงทะเบียนในหลังบ้านด้วยบัญชี `<repo>.admin` แล้ว admin ระบบกลางอนุมัติและเปิดใช้งาน (สถานะ APPROVED + ACTIVE)
- [ ] `default_role_mapping` ใส่ครบทุก core role ที่ต้องการให้เข้าได้ (key ตัวพิมพ์เล็ก อย่างน้อย 1 ตัว)
- [ ] `callback_url` ใช้พอร์ต **frontend** ตรงกับ URL จริง และเป็น https (ยกเว้น `http://localhost` ช่วงก่อนเปิดใช้)
- [ ] ชื่อระบบในทะเบียน = `name` ใน `subsystem.yaml` = `SUBSYSTEM_ID` ของ backend และ frontend

## โค้ด

- [ ] คัดลอกชั้น auth จาก reference implementation โดยไม่แก้ตรรกะ (`all-exceptions.filter.ts` รุ่นหลัง 1 ต.ค. 2569)
- [ ] ตรวจ token ครบ 10 ขั้น รวมอายุ token และ `azp` (auth-contract ข้อ 4) · มี `GET /auth/login` · `POST /auth/logout`
- [ ] `role-mapping` ในโค้ด **ตรงกับ** `default_role_mapping` ในทะเบียน
- [ ] permission ใช้รูปแบบ `<resource>:<action>[:own|:any]`
- [ ] การตรวจ `:own` ทำกับข้อมูลจริงในชั้น service
- [ ] ไม่มี endpoint login/register/refresh ของตัวเอง
- [ ] ไม่มีไฟล์ `.pem` / `.key` / `.env` ใน git
- [ ] structured log ครบตาม `contracts/log-events.json` · logger และ error filter log แค่ path (ไม่มี query) · ไม่มี token หลุดใน log
- [ ] ไม่มีตารางหรือ seed ของคณะ ห้อง ภาคการศึกษา รายวิชา หลักสูตร — เก็บแค่ `code` แล้วเรียก Core Hub จาก backend
- [ ] ข้อมูลคนเก็บแค่ `core_user_id` (text ไม่ใช่ UUID) กับ `person_code` · ไม่เก็บชื่อ/อีเมล · ไม่ cache ข้อมูลบุคคล
- [ ] ไม่มี URL ของ Core Hub เขียนตายในโค้ด (อ่านจาก env) · ไม่มีรหัสผ่านใน `subsystem.yaml`

## Naming (conformance ตรวจให้ไม่ได้ ต้องรีวิวด้วยตา)

- [ ] ตารางเป็นพหูพจน์ snake_case ผ่าน `@@map` · คอลัมน์ snake_case ผ่าน `@map`
- [ ] PK เป็น `id` UUID v4 · FK เป็น `<entity>_id` · ทุกตารางมี `created_at`/`updated_at`
- [ ] Global Identity ใช้ชื่อ `core_user_id` เท่านั้น
- [ ] resource ใน URL เป็นพหูพจน์ kebab-case ใต้ `/api/v1/`
- [ ] `POST`→201 · `DELETE`→200 + `{id, deleted:true}` · ไม่มี trailing slash
- [ ] `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → **No difference detected**
- [ ] migration เดิมไม่ถูกลบ/squash และรันบน DB เปล่าได้

## สัญญา API

- [ ] `GET /api/health` → `{success, data:{status:"ok", service:"<name>"}}`
- [ ] `GET /api/v1/me` → `{id, email, coreRole, subsystemRole}`
- [ ] คอลเลกชันมี `meta{total,page,limit,totalPages}` และรองรับ `?page=&limit=`
- [ ] error ใช้ code จาก enum ปิด 9 ค่า (`contracts/error-codes.json`) · `VALIDATION_ERROR` = 400 · 429/503 มี `Retry-After`
- [ ] 401 vs 403 ถูกต้องทุกกรณี · ไม่มี stack trace หลุด

## เกณฑ์ตัดสิน

- [ ] `./standards/scripts/run-all-checks.sh .` → เขียวทุกข้อ
- [ ] `node standards/conformance/run.js` (ไฟล์บัญชีนอก repo ผ่าน `CONFORMANCE_ACCOUNTS_FILE`) → **0 failed, 0 skipped**
- [ ] login ผ่าน SSO กับ server จริงได้ทั้งจากปุ่ม login ของระบบ และจากเมนูในพอร์ทัล

```text
RESULT: ___ passed · 0 failed · 0 skipped
✅ CONFORMANT — <subsystem> meets standard v1.2 <level>
```

## เอกสารและการส่งมอบ

- [ ] `README.md` — ติดตั้ง · รัน · ทดสอบ (คำสั่งรันได้จริงทุกบรรทัด)
- [ ] `.env.example` ครบทุกตัวแปร · `subsystem.yaml` ประกาศ `probes` ครบ
- [ ] `REPORT.md` ตามรูปแบบใน `AGENTS.md` ข้อ 6
- [ ] unit test กฎธุรกิจของตัวเอง (อย่างน้อยเคส 403 และ 409 อย่างละ 1)

---

## สำหรับผู้รีวิว

| ตรวจ | วิธี | ผ่าน |
|---|---|---|
| conformance ผ่านจริง | รันเอง ไม่เชื่อผลที่ทีมแนบมา | ☐ |
| ไม่มีการแก้ standards/ | `git -C standards status --short` ต้องว่าง | ☐ |
| ไม่มี login ของตัวเอง | `grep -rn "password" backend/src` ต้องว่าง · `login` เจอได้แค่ controller ของ `GET /auth/login` ที่ redirect ไป Core Hub | ☐ |
| ไม่มี token หลุดใน log | login ผ่าน SSO หนึ่งรอบแล้ว `grep -iE "eyJ\|access_token=\|authorization:\|cookie:"` ใน log ต้องว่าง | ☐ |
| ไม่มีความลับใน repo | `git log -p \| grep -i "BEGIN.*PRIVATE KEY"` | ☐ |
| mapping ตรงกับทะเบียน | เทียบโค้ดกับ `GET /api/v1/subsystems/:id/role-mapping` | ☐ |
| DB แยกจริง | ดู `DATABASE_URL` + `pg_stat_activity` | ☐ |
| naming ถูกต้อง | `\d+ <table>` ใน psql — คอลัมน์ต้องเป็น snake_case | ☐ |
