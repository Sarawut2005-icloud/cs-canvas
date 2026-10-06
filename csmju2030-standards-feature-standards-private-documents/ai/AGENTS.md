# AGENTS.md — กติกาสำหรับ AI Agent ที่พัฒนาระบบย่อย CSMJU2030

> เขียนสำหรับ **AI coding agent** (Claude Code, Codex, Cursor, Copilot, Gemini CLI ฯลฯ)
> แนบไฟล์นี้ไปกับคำสั่งงานทุกครั้ง หรือวางไว้ที่รากของ repo (agent ส่วนใหญ่อ่านไฟล์ชื่อนี้อัตโนมัติ)

---

## 0. กฎสูงสุด 6 ข้อ

```text
1. อ่าน standards/docs/overview.md แล้วตามด้วยเอกสารที่มันชี้ ก่อนเขียนโค้ดบรรทัดแรก
2. ตัวตัดสินว่างานเสร็จคือ CI + conformance เท่านั้น ไม่ใช่ความมั่นใจของคุณ
3. ห้ามแก้ไฟล์ใน standards/ (เป็น submodule) โดยเด็ดขาด
4. ห้ามรายงานว่าเสร็จ ถ้ายังมีเคส FAIL หรือ SKIP
5. สิ่งที่มาตรฐานไม่ได้ระบุ ให้ทำตาม reference implementation — ห้ามคิดรูปแบบใหม่เอง
6. stack บังคับ: Node 22 · NestJS 11 · Prisma 7.9.1 · PostgreSQL · pnpm (+ Next.js ถ้ามี frontend)
```

---

## 1. ลำดับการทำงาน (ห้ามข้ามขั้น)

```text
ขั้น 1  อ่าน standards/docs/{overview,connect-core-hub,reference-data,tech-stack,auth-contract,authorization,api-conventions,data-dictionary}.md
ขั้น 2  ตรวจว่าต่อ Core Hub ได้:  curl {CORE_HUB_URL}/api/v1/health   (CORE_HUB_URL = https://csmju2030.jowave.com)
ขั้น 3  คัดลอกชั้น auth จาก reference implementation (ดูข้อ 2) — ห้ามแก้ตรรกะข้างใน
ขั้น 4  สร้าง subsystem.yaml จาก standards/templates/subsystem.yaml
ขั้น 5  ให้คนลงทะเบียนระบบในหลังบ้านของ Core Hub (บัญชี <repo>.admin → admin ระบบกลางอนุมัติ) — agent ทำขั้นนี้แทนไม่ได้
ขั้น 6  ให้ conformance ระดับ L1 ผ่านก่อน (บัญชีอ่านจากไฟล์นอก repo — docs/conformance.md):
            CONFORMANCE_ACCOUNTS_FILE=~/.csmju/conformance-accounts.json node standards/conformance/run.js --level L1
ขั้น 7  เขียน business domain ของตัวเอง (model · API · กฎธุรกิจ · permission)
ขั้น 8  รัน L2 → แก้จนผ่าน
ขั้น 9  รัน L3 → แก้จนผ่าน
ขั้น 10 รัน ./standards/scripts/run-all-checks.sh . ให้เขียวทุกข้อ
ขั้น 11 เขียน REPORT.md (ดูข้อ 6) แล้วจึงรายงานว่าเสร็จ
```

ถ้า L1 ยังไม่ผ่าน การเขียน business logic ต่อคือการสร้างหนี้

---

## 2. สิ่งที่ต้อง "คัดลอก" ไม่ใช่ "เขียนใหม่"

reference implementation: `demo-student-subsystem/backend/` (ตั้งแต่ standards 1.7.0 — SSO 1.1 · ตรวจ token 10 ขั้น)

| คัดลอกทั้งไฟล์/โฟลเดอร์ | แก้ได้ไหม |
|---|---|
| `src/auth/jwks.service.ts` · `core-hub-token.verifier.ts` · `auth.errors.ts` · `core-hub-identity.ts` | ❌ ห้ามแก้ตรรกะ |
| `src/auth/guards/` · `src/auth/decorators/` | ❌ ห้ามแก้ |
| controller ของ `/auth/login` · `/auth/callback` · `/auth/logout` · `sso-session.ts` · `me.controller.ts` | ❌ ห้ามแก้ |
| `src/common/` (envelope + exception filter) | ❌ ห้ามแก้ — **ใครคัดลอก `all-exceptions.filter.ts` ไปก่อน 1 ต.ค. 2569 ต้องคัดลอกใหม่** (ตัวเก่า log URL ของ callback ที่มี token) |
| `src/core-hub/` (ตัวเรียกข้อมูลกลาง: cache · timeout · ใช้ของเก่าเมื่อ Core Hub ล่ม) | ❌ ห้ามแก้ตรรกะ · เพิ่มชุดข้อมูลที่ `reference-datasets.ts` ได้ |
| `src/auth/role-mapping.ts` | ✏️ แก้ได้เฉพาะ "ค่า" ในตาราง ให้ตรงกับทะเบียน |
| `src/auth/permissions.ts` | ✏️ เขียน permission ของโดเมนตัวเอง (คงรูปแบบ `resource:action[:scope]`) |
| `prisma/` และโมดูลธุรกิจ | ✍️ เขียนเองทั้งหมด |

ชั้น auth คือส่วนที่ต้อง "เหมือนกันทุกทีม" การเขียนเองทำให้เกิดความต่างที่ตรวจจับยาก
และ `SEC-04` จะตีตกทันทีถ้าไม่ได้ verify ผ่าน JWKS + `kid`

---

## 3. สิ่งที่ agent มักทำผิด

| ❌ ห้ามทำ | ✅ ต้องทำ |
|---|---|
| "เพิ่ม `/login` ให้เผื่อไว้" | ระบบย่อยไม่มีหน้า login หรือฟอร์มรหัสผ่าน — ผู้ใช้ล็อกอินที่ Core Hub เท่านั้น (`SEC-05`) · `GET /auth/login` ที่ต้องมีเป็นแค่ตัว redirect ไป Core Hub ([auth-contract](../docs/auth-contract.md) ข้อ 5) |
| "ทำ session ของระบบย่อยเอง จะได้ไม่หลุดทุก 15 นาที" | session คือ Core Hub token ในคุกกี้ `<ชื่อ>_access_token` ที่หมดอายุพร้อม token · ไม่หลุดเพราะ silent re-SSO (auth-contract ข้อ 7) · ห้ามมีตาราง session / session id / token ของตัวเอง |
| "API ตอบ 302 ไป login ตอน token หมดอายุ" | API (`/api/*`) ตอบ **401 JSON** เสมอ — `fetch` ตาม redirect ข้าม origin ไม่ได้ การพาไป login เป็นหน้าที่ของ frontend |
| "ส่งเบราว์เซอร์ไป `/api/v1/auth/sso/authorize` ของ Core Hub ตรง ๆ" | endpoint นั้นต้องมี Bearer ที่เบราว์เซอร์แนบไม่ได้ → 401 · ให้ส่งไป **เว็บ** ของ Core Hub `{CORE_HUB_WEB_URL}/sso/authorize` ผ่าน `/auth/login` ของตัวเอง |
| "ต่ออายุ token ด้วย `fetch` ไป `/auth/login`" | ต้องเป็น top-level navigation (`window.location.assign`) — `fetch` ไม่ได้คุกกี้และติด CORS |
| "ทำตาราง users ของตัวเองไว้ก่อน" | เก็บได้แค่ `core_user_id` (ค่า `sub`) และ `person_code` เป็น external reference |
| "`core_user_id` เป็น UUID ใส่ `@db.Uuid` / `@IsUUID()`" | `sub` เป็น string ทึบ **ไม่ใช่ UUID เสมอไป** (นักศึกษาที่นำเข้าจาก CSV เป็น `user-<รหัส>`) — เก็บเป็น text ยาวไม่เกิน 64 |
| "เก็บชื่อ/อีเมลผู้ใช้ไว้ในตารางจะได้แสดงผลเร็ว" · "cache ข้อมูลบุคคล" | ห้ามเก็บและห้าม cache ข้อมูลบุคคล — เก็บ `person_code` แล้วดึงชื่อตอนแสดงผล ([`reference-data.md`](../docs/reference-data.md)) |
| "สร้างตาราง/seed คณะ ห้อง ภาคการศึกษา รายวิชาเอง" · "อ้างด้วย `id`" | ข้อมูลกลางอยู่ที่ Core Hub — เก็บแค่ `code` แล้วเรียก `/api/v1/<ชุดข้อมูล>` · Core Hub ไม่ส่ง `id` ออกมา |
| "เรียก API ของ Core Hub จากหน้าเว็บ (browser)" | Core Hub ไม่เปิด CORS — เรียกจาก **backend** ด้วย token ของผู้ใช้ เฉพาะ endpoint ที่อนุญาต |
| "ส่ง token ของผู้ใช้ไปให้ service อื่น / เก็บลง DB / ส่งให้ JavaScript" | token คือบัตรผ่านของผู้ใช้ — อยู่ได้ที่คุกกี้ HttpOnly อย่างเดียว ([auth-contract](../docs/auth-contract.md) ข้อ 6.1) |
| "log `request.url` / `originalUrl` ใน error filter หรือ logger" | log แค่ `request.path` — URL ของ `/auth/callback` มี token · ห้าม log header `Authorization`/`Cookie` |
| "ตรวจ token แค่ 8 ขั้นเหมือนเดิม" | ต้องครบ 10 ขั้น: เพิ่มอายุ token (`exp − iat` ≤ 900 + 60 วินาที) และ `azp` เมื่อมี (auth-contract ข้อ 4) |
| "ฮาร์ดโค้ด `http://localhost:3000` · `3100` ไว้ในโค้ด" | อ่าน `CORE_HUB_URL` · `CORE_HUB_WEB_URL` จาก env (server จริงคือ `https://csmju2030.jowave.com`) |
| "ลงทะเบียน callback เป็นพอร์ต backend" · "เปิดแอปด้วย `127.0.0.1`" | callback ใช้พอร์ต **frontend** (32xx) และเปิดด้วย host เดียวกับที่ลงทะเบียน (`localhost`) |
| "แมป `staff` ทั้งหมดเป็น ADMIN ของระบบ" | ผู้ดูแลที่เป็นแค่บางคนให้ใช้สิทธิ์พิเศษรายบุคคลผ่านทะเบียน — ห้ามเขียนรายชื่อตายตัวในโค้ด |
| "ใส่ `test_accounts` พร้อมรหัสผ่านใน `subsystem.yaml`" | ห้ามมีรหัสผ่านใน repo — conformance อ่านจากไฟล์นอก repo (`CONFORMANCE_ACCOUNTS_FILE`) |
| "ตอบ 401 ตอนสิทธิ์ไม่พอ" | สิทธิ์ไม่พอ = **403** เสมอ · 401 ใช้ตอนไม่รู้ว่าเป็นใคร |
| "ตอบ 404 แทน 403 เพื่อความปลอดภัย" | มาตรฐานบังคับ 403 (conformance จับ) |
| "ตั้งชื่อ error code ให้สื่อกว่า" | ใช้ enum ปิดใน `standards/contracts/error-codes.json` |
| "ใช้ jsonwebtoken / passport-jwt ก็ได้" | ต้องใช้ `jose` เพราะต้องรองรับ JWKS + `kid` |
| "ฮาร์ดโค้ด public key ไว้ก่อน" | ต้องดึงจาก JWKS และเลือกด้วย `kid` |
| "ตั้งชื่อคอลัมน์เป็น camelCase ใน DB" | DB เป็น `snake_case` ผ่าน `@map` · field ใน Prisma เป็น camelCase |
| "endpoint ชื่อ `/api/v1/borrowRecord`" | พหูพจน์ kebab-case: `/api/v1/borrow-records` |
| "ใช้ `per_page` สำหรับ pagination" | ใช้ `?page=&limit=` |
| "ใช้ npm/yarn ก็เหมือนกัน" | ใช้ **pnpm** เท่านั้น (`QA-05`) |
| "`prisma migrate dev` เปลี่ยนชื่อคอลัมน์" | จะกลายเป็น drop+add ข้อมูลหาย — เขียน `RENAME COLUMN` เอง |
| "แก้เทส/สคริปต์ให้ผ่าน" | ห้ามแตะ `standards/` — ให้แก้โค้ดตัวเอง |
| "`typecheck` ของ frontend ใช้ `tsc --noEmit` พอ" | ต้องเป็น `next typegen && tsc --noEmit` ไม่งั้นผ่านในเครื่องแต่ตกบน CI (`tech-stack.md` ข้อ 1.2.1) |
| "ตั้ง `BACKEND_URL` ตอนรัน container ให้ชี้ backend" | `rewrites()` ถูกฝังตอน `next build` — ใน image ต้อง build ด้วย `http://api:4000` (service `api`) ตาม Dockerfile ของ template ([deployment](../docs/deployment.md) ข้อ 3.2) |
| "ใส่ `USER node` ใน build stage ก็พอ" · "`chown -R node:node /app` ให้ชัวร์" | `USER` ต้องอยู่ใน **stage สุดท้าย** (`DEP-02`) · ห้าม `chown -R` ทั้งแอป — image โตเท่าตัว และ `node` อ่านไฟล์ของ root ได้อยู่แล้ว |
| "ใส่ค่า env ของ server ไว้ใน Dockerfile" · "เขียนไฟล์ลงโฟลเดอร์แอป" | ค่าทุกอย่างมาจาก env ตอนรัน (ค่าลับห้ามอยู่ใน `ARG`/`ENV`) · container อ่านอย่างเดียว เขียนได้แค่ `/tmp` — ไฟล์ผู้ใช้เก็บผ่าน Core Hub |
| "mount `/var/run/docker.sock` ให้ api สั่ง Docker ได้" · "รันโค้ดของผู้ใช้ด้วย `child_process`" | ห้ามทั้งคู่ — socket ของ Docker = root ทั้ง server · ระบบที่ต้องรันโค้ดผู้ใช้ใช้ Docker แบบ rootless ที่ server เตรียมให้ผ่าน `DOCKER_HOST` และต้องได้อนุมัติ ([deployment](../docs/deployment.md) ข้อ 8) |
| "อัปโหลดบิล สลิป หรือ PDF ไปที่ Core Hub `/images`" · "เขียนไฟล์ลงดิสก์ของ server" | `/images` เปิดสาธารณะ · cache 1 วัน · แปลงเป็น WebP — เอกสารที่ต้องตรวจสิทธิ์หรือเก็บต้นฉบับเก็บในฐานของระบบเอง ตรวจชนิดจาก byte ต้นไฟล์ ([deployment](../docs/deployment.md) ข้อ 4.3) |
| "ผูกบัญชี LINE หรือแชตให้สร้างรายการแทนผู้ใช้" | ตัวตนต้องมาจาก token ที่ตรวจแล้วเท่านั้น ([auth-contract](../docs/auth-contract.md) ข้อ 9) — ช่องทางแชตต้องคุยกับ PL ก่อน |
| "`CREATE EXTENSION` ใน migration" · "`new URL(path, request.url)` ทำ redirect" | role บน server ไม่ใช่ superuser — extension ต้องขอ DevOps · URL เต็มจาก request ผิดเมื่ออยู่หลัง Cloudflare/Apache — ใช้ path หรือ `CORE_HUB_WEB_URL` ([deployment](../docs/deployment.md) ข้อ 3.4 · 4.1 · 6.1) |
| "รายงานว่าเสร็จ น่าจะผ่าน" | ต้องแนบผลรันจริงของ CI + conformance |

---

## 4. คำสั่งที่ต้องรันได้เสมอ

```bash
pnpm install
pnpm --filter backend build
pnpm --filter backend test
pnpm --filter backend start:dev

# ตรวจ typecheck แบบเดียวกับ CI (ลบของค้างก่อน ไม่งั้นผ่านหลอก)
rm -rf frontend/.next && pnpm -r typecheck

# image แบบเดียวกับ server — db + api + web ต้อง healthy (docs/deployment.md ข้อ 6)
docker compose up -d --build && docker compose ps

# ตัวตัดสิน
./standards/scripts/run-all-checks.sh .        # static — เหมือน CI
CONFORMANCE_ACCOUNTS_FILE=~/.csmju/conformance-accounts.json node standards/conformance/run.js   # runtime — ยิงระบบจริง
```

---

## 5. เกณฑ์ผ่าน

```text
RESULT: <n> passed · 0 failed · 0 skipped
✅ CONFORMANT — <subsystem> meets standard v1.2 <level>
```

- **0 failed** เท่านั้นจึงผ่าน
- **SKIP ไม่นับว่าผ่าน** — แปลว่า `probes` ใน `subsystem.yaml` ยังประกาศไม่ครบ หรือไฟล์บัญชีไม่มี role ที่ต้องใช้
  (runner ตอบ NOT CONFORMANT ถ้ามี SKIP)
- ถ้าเชื่อว่าเคสใดผิดที่ตัวมาตรฐานเอง **ห้ามแก้** ให้บันทึกใน `REPORT.md` แล้วแจ้ง PL

---

## 6. REPORT.md ที่ต้องส่งพร้อมงาน

````markdown
# REPORT — <subsystem>

## ผลรัน
```
<ผล ./standards/scripts/run-all-checks.sh . 10 บรรทัดสุดท้าย>
<ผล node standards/conformance/run.js 10 บรรทัดสุดท้าย>
```

## ไฟล์ที่สร้าง/แก้ไข
- path — ทำอะไร (เหตุผลสั้น ๆ)

## ชั้น auth ที่คัดลอกมา
- คัดลอกจาก demo-student-subsystem: <รายการไฟล์>
- แก้ไข: <ระบุ ถ้าไม่มีให้เขียน "ไม่มี">

## Role mapping ที่ประกาศ (ต้องตรงกับ default_role_mapping ในทะเบียน)
| core role | subsystem role |
|---|---|

## ข้อสมมติที่ตั้งเอง (เพราะมาตรฐานไม่ได้ระบุ)
1. …

## สิ่งที่ยังทำไม่ได้ / เคสที่ยังไม่ผ่าน
- (ถ้าไม่มี ให้เขียน "ไม่มี")
````

---

## 7. เทมเพลตคำสั่งสำหรับผู้สั่งงาน

ดู [`TASK_TEMPLATE.md`](TASK_TEMPLATE.md) — คัดลอกไปวางใน AI ตัวไหนก็ได้ ผลลัพธ์ควรออกมาเทียบเท่ากัน
