# มาตรฐาน PM ของ CSMJU2030 ที่ทุกระบบย่อยต้องทำตาม (สรุปสำหรับ Claude)

> **สรุปเมื่อ:** 2 ต.ค. 2569 จาก `csmju2030-standards` 1.7.0 (branch `feature/standards-compliance-exception-template`), `design-system` 1.3.0 และ `csmju-core-hub` develop
> **ต้นฉบับที่ใช้ตัดสินจริง:** submodule `standards/` ใน repo ของทีม · ถ้าไฟล์นี้ขัดกับต้นฉบับ ให้เชื่อต้นฉบับแล้วแก้ไฟล์นี้
> **ต้นแบบที่ทำเสร็จแล้ว:** `C:\Users\User\cs-nexus` (csmju-nexus) ผ่าน conformance 1.7 แบบ 69/0/0 ให้เปิดดูโค้ดและ `docs/HANDOVER.md` ของ nexus เมื่อไม่แน่ใจ

---

## 0. กฎสูงสุด (จาก `standards/ai/AGENTS.md`)

1. อ่าน `standards/docs/overview.md` แล้วอ่านเอกสารที่มันชี้ **ก่อนเขียนโค้ดบรรทัดแรก**
2. งานเสร็จเมื่อ **CI กับ conformance ผ่าน** เท่านั้น ความมั่นใจของ AI ไม่นับ
3. **ห้ามแก้ไฟล์ใน `standards/`** (เป็น submodule) และห้ามแก้ `.github/` (`ci.yml`, CODEOWNERS) กับไฟล์ whitelist
4. ห้ามรายงานว่าเสร็จถ้ายังมีเคส **FAIL หรือ SKIP** แม้แต่ข้อเดียว เพราะ SKIP นับเป็น NOT CONFORMANT
5. เรื่องที่มาตรฐานไม่ได้ระบุ ให้ทำตาม reference implementation (`demo-student-subsystem`) **ห้ามคิดรูปแบบใหม่เอง**
6. Stack ที่บังคับ: **Node 22 · NestJS 11 · Prisma 7.9.1 · PostgreSQL 16+ · pnpm · Next.js (App Router) ถ้ามีหน้าเว็บ**

## 1. สถาปัตยกรรม

| เรื่อง | กฎ |
|---|---|
| repo | 1 ระบบย่อย = 1 repo ใน org `CSMJU2030` ชื่อ `csmju-<ระบบ>` · DevOps เป็นคนสร้าง repo ให้ ห้ามสร้างเอง |
| โครงสร้าง | `frontend/src/` (Next.js) กับ `backend/src/` (NestJS) · pnpm workspace |
| Backend | **ต้องเป็น NestJS** (`ARC-04`) · Next.js ทำหน้าเว็บเท่านั้น ข้อมูลและ business logic อยู่ที่ backend |
| Database | **ฐานข้อมูลของระบบตัวเองเท่านั้น** (`ARC-01`) · ห้ามต่อฐานของ Core Hub หรือของระบบอื่น · frontend ห้ามต่อ DB ตรง |
| ORM | Prisma **7.9.1 pin เป๊ะทั้งสามตัว** (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) ห้ามใส่ `^` · ใช้ driver adapter `PrismaPg` |
| ทางเข้า | **frontend เป็นประตูเดียว** · `next.config.ts` rewrite `/api/*` และ `/auth/login` `/auth/callback` `/auth/logout` ไปที่ backend |
| พอร์ต | frontend `32xx` / backend `42xx` ตามที่ผู้ดูแล dev server ให้ (ดูใน CLAUDE.md ของโปรเจกต์) · ห้ามใช้ 5432 |

## 2. Dependency whitelist (`ARC-02`, CI ตีตกทันที)

- **frontend:** next, react, react-dom, typescript, tailwindcss, @tailwindcss/postcss, postcss, autoprefixer, **@csmju2030/design-system**, zustand, axios, @tanstack/react-query, lucide-react, leaflet, qrcode.react, zod, openapi-typescript, eslint, prettier, vitest, @testing-library/react
- **backend:** @nestjs/{cli,common,config,core,mapped-types,platform-express,schedule,swagger,testing}, @prisma/adapter-pg, @prisma/client, prisma, pg, class-transformer, class-validator, dotenv, jose, reflect-metadata, rxjs, zod, jest, supertest, eslint, prettier, typescript
- **devDependencies:** รายการ `allowed_dev_tooling` (jest, ts-jest, vitest, jsdom, eslint-config-next, typescript-eslint ฯลฯ) และ `@types/*`
- **ห้ามเด็ดขาด:** MUI, antd, bootstrap, chakra, daisyui, mantine, express (ตรง), fastify, koa, mysql, mongodb, mongoose, sequelize, typeorm, **jsonwebtoken, passport-jwt** (ต้องใช้ `jose`)
- ไลบรารีนอกรายการ (เช่น socket.io, fabric, konva, redis, monaco) **ใช้ได้เมื่อได้รับอนุมัติข้อยกเว้นเท่านั้น**
  1. เปิด issue ใน `csmju2030-standards` ด้วยฟอร์ม "ขอข้อยกเว้นมาตรฐาน"
  2. PL รับรอง
  3. PM กับ DevOps อนุมัติ
  4. DevOps เพิ่มลง `.compliance-exceptions.yml` ซึ่งต้องมี `check`, `scope` (ห้ามใช้ `*`), `dependency`, `reason`, `approved_by`, `issue` และ `expires`
  - **ไม่มีข้อยกเว้นถาวร** · ห้ามแก้ whitelist เอง

## 3. Auth: SSO 1.1 (`auth-contract.md` 1.2) · **คัดลอกจาก demo ห้ามเขียนเอง**

- **คัดลอกทั้งโฟลเดอร์ ห้ามแก้ตรรกะ:**
  - `backend/src/auth/`: jwks.service, core-hub-token.verifier, guards, decorators, sso controller, sso-session, me.controller
  - `backend/src/common/`: envelope และ exception filter
  - **ตัวที่คัดลอกไปก่อน 1 ต.ค. 2569 ต้องคัดลอกใหม่** เพราะตัวเก่า log URL ที่มี token
- `GET /auth/login`
  - สร้าง `state` อย่างน้อย 32 ไบต์
  - ตั้งคุกกี้ `<ชื่อระบบ>_sso_state` (`Path=/auth/callback`, `Max-Age` ≤ 600, HttpOnly)
  - 302 ไป `{CORE_HUB_WEB_URL}/sso/authorize?subsystem=&state=`
- `GET /auth/callback` ตามตาราง 5.1:
  - ไม่มี token → 400
  - ไม่มี state → ทิ้ง token แล้ว 302 `/auth/login`
  - state ไม่ตรง → 401 (หน้า "เข้าสู่ระบบอีกครั้ง")
  - token ไม่ผ่าน → 401 · role ไม่อยู่ใน mapping → 403
  - ผ่าน → ตั้งคุกกี้ `<ชื่อระบบ>_access_token` แล้ว 302 ไปหน้าเดิม
  - ใส่ `no-store` · **ห้าม log URL** (มี token อยู่ใน URL)
- `POST /auth/logout` ลบคุกกี้ทั้งสองตัว แล้ว 303 ไป `{CORE_HUB_WEB_URL}/logout`
- **ตรวจ token 10 ขั้น** ผ่าน JWKS + `kid` (RS256, `iss=core-hub`, `aud=csmju2030`, `kid=core-hub-2026`) รวมขั้น 9 (`exp − iat` ≤ 900+60) และขั้น 10 (`azp` ถ้ามี)
- **core role 6 ค่า:** student, alumni, staff, lecturer, guest, admin · map เป็น role ของระบบตัวเองใน `role-mapping.ts` และ `subsystem.yaml` ให้ตรงกัน · role ที่ไม่อยู่ใน mapping ได้ 403
- frontend: ได้ 401 → พาทั้งหน้าไป `/auth/login?next=<หน้าปัจจุบัน>` พร้อมกันวน · logout เป็นฟอร์ม POST
- **ห้ามมีหน้า login ของตัวเอง ห้ามเก็บรหัสผ่าน** และห้ามเก็บชื่อหรืออีเมล · รูปโปรไฟล์ รหัสผ่าน และอีเมลเป็นของ Core Hub
- token ห้ามอยู่ใน localStorage หรือ sessionStorage (`SEC-03`)

## 4. API (`api-conventions.md`)

| หัวข้อ | กฎ |
|---|---|
| path | `/api/v1/<resources>` · พหูพจน์ · kebab-case · ห้ามมีกริยาใน path · nest ได้ไม่เกิน 1 ชั้น · path param เป็น UUID v4 (ไม่ใช่ → 400) |
| นอก `/api/v1` | มีแค่ 4 เส้น: `GET /api/health` (`{status, service}`), `/auth/login`, `/auth/callback`, `/auth/logout` |
| **JSON** | **field เป็น camelCase** (`studentCode`, `createdAt`, `coreUserId`) · ใช้ snake_case เฉพาะ field ของ OAuth · query param เป็น camelCase |
| envelope | `{ success, data, meta? }` · list ต้องมี `meta: {total, page, limit, totalPages}` · ใช้ `?page=&limit=` (ห้าม `per_page`) |
| error | `{ success:false, error:{ code, message, details? } }` · `code` เลือกได้จาก **9 ค่า** เท่านั้น ได้แก่ BAD_REQUEST, VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, TOO_MANY_REQUESTS, INTERNAL_ERROR, SERVICE_UNAVAILABLE (`contracts/error-codes.json`) · 429 และ 503 ต้องมี `Retry-After` |
| status | สร้าง → 201 · ลบ → 200 + `{id, deleted:true}` · validation ผิด → **400** (ไม่ใช่ 422) |
| OpenAPI | `@nestjs/swagger` export ไปที่ `openapi.json` ใน repo · CI ตรวจว่าตรงกับโค้ด (`API-01`) · frontend generate type ด้วย `openapi-typescript` |
| logging | log แค่ path เป็น JSON บรรทัดเดียว · ห้าม log token, `access_token=`, header Authorization/Cookie หรือข้อมูลบุคคล |

## 5. ข้อมูล (`data-dictionary.md`, `reference-data.md`)

- ตารางเป็น plural snake_case (`@@map`) · คอลัมน์เป็น snake_case (`@map`) · field ใน Prisma กับ JSON เป็น camelCase · enum เป็น PascalCase ส่วนค่าเป็น UPPER_SNAKE (`DD-03`)
  - relation ย้อนกลับที่ชื่อเป็น camelCase ให้ใส่ `@relation("ชื่อ")` ทั้งสองฝั่ง ไม่อย่างนั้นตัวตรวจ DD-03 จะตีตก (เจอจริงใน nexus)
- ผู้ใช้อ้างถึงด้วย **`core_user_id` (text, ค่า `sub`)** เท่านั้น · **ห้ามตั้งชื่อ `userId` หรือ `user_id`** (`DD-01`) · เก็บได้แค่ `core_user_id` กับ `person_code`
- คณะ ห้อง ภาคการศึกษา รายวิชา และหลักสูตร **ห้ามทำตารางหรือ seed เอง และห้าม hardcode** (`DD-04`) · เก็บแค่ `code` แล้วดึงจาก Core Hub ผ่าน backend
- เงินเก็บเป็น integer (สตางค์) · migration ห้ามลบและห้าม squash · เปลี่ยนชื่อคอลัมน์ใช้ `RENAME COLUMN`
- ใช้ `prisma migrate deploy` เท่านั้น · **ห้าม `migrate reset`** ถ้า PL ไม่อนุญาต

## 6. UI (`ui-design-system.md` + `@csmju2030/design-system` 1.3.0)

- ใช้ **`@csmju2030/design-system` เท่านั้น** ติดตั้งจาก registry `https://npm.pkg.github.com` ของ org ด้วย pnpm
- ครอบทุกหน้าด้วย `<CsmjuAppShell>` ที่ `app/layout.tsx` จุดเดียว · header, เมนูผู้ใช้, การแจ้งเตือน และ login/logout เป็นของ AppShell ซึ่งล็อกไว้
- สี ฟอนต์ spacing radius และ motion ใช้ได้เฉพาะ token `--csmju-*` หรือ utility ของ preset · **ห้ามใช้ hex ดิบ** (`UI-01`) และห้าม arbitrary value อย่าง `p-[15px]`
- ห้ามติดตั้ง UI library อื่น (shadcn, MUI ฯลฯ) · ห้ามสร้าง `components/ui/` · ห้ามสร้าง component ที่ DS มีอยู่แล้ว
- ห้ามใช้ `next/font/google` เพราะฟอนต์มาจาก `styles.css` ของ package แล้ว
- ใช้ภาษาไทยเป็นหลัก · ฟอนต์ขั้นต่ำ 14px · line-height ≥ 1.6 · ห้ามใช้ emoji เป็นไอคอนของ UI · ใช้ `<button>` และ `<Link>` ห้ามใช้ `<div onClick>` · ทุก input ต้องมี `<FormField label>`
- ต้องมี loading, empty และ error state ครบ · เป็นไปตาม WCAG 2.1 AA · ตรวจด้วย `csmju-ui-lint` (DS-01..22)
- **จุดอิสระ:** flow, จำนวนหน้า, ชื่อเมนู, business logic, state management และ chart/canvas/ฉากเกม (ใช้ palette จาก token)
- ⚠️ nexus ทำหน้าตาแบบ IG/Discord เองก่อนที่ DS จะออก · การย้ายมาใช้ DS เป็นงานที่ค้างของ nexus · **โปรเจกต์ใหม่ให้เริ่มจาก DS เลย** โดยลอก `design-system/examples/subsystem-template/frontend/`

## 7. Core Hub และ dev server

- **Core Hub ตัวจริง:** `https://csmju2030.jowave.com` (`CORE_HUB_URL` และ `CORE_HUB_WEB_URL`) · ไม่ต้องโคลนหรือรัน Core Hub เอง
  - **repo ของ Core Hub มีข้อมูลนักศึกษาจริง ถ้าเคยโคลนไว้ต้องลบทิ้ง**
- ทดสอบก่อนเขียนโค้ด:
  - `curl https://csmju2030.jowave.com/api/v1/health` ต้องได้ 200
  - `/api/v1/.well-known/jwks.json` ต้องขึ้นต้นด้วย `{"keys":[`
- **ลงทะเบียน:** PL ล็อกอิน backoffice ด้วยบัญชีเจ้าของระบบของทีม (role staff) แล้วใส่ callback `http://localhost:32xx/auth/callback` (พอร์ต frontend) · ช่วงนี้อยู่ในโหมดก่อนเปิดใช้ จึงรับ callback localhost
- **บัญชีและรหัสผ่านห้ามอยู่ใน repo:**
  - conformance อ่านบัญชีจาก `CONFORMANCE_ACCOUNTS_FILE=~/.csmju/conformance-accounts.json` ซึ่งเป็นไฟล์นอก repo
  - ห้ามมี `test_accounts` ใน `subsystem.yaml`
  - login ผิด 10 ครั้งใน 15 นาที บัญชีจะถูกล็อก
- `.env` ห้าม commit · ใช้ `SUBSYSTEM_ID` ตัวเดียวกันทั้ง backend และ frontend ให้ตรงกับชื่อในทะเบียน · ห้าม hardcode `localhost:3000` หรือ `3100`

## 8. Git, CI และการตรวจ

- **branch:** `feature/<ระบบ>/<เรื่อง>` หรือ `fix/<ระบบ>/<เรื่อง>` · **commit:** `feat(<ระบบ>): …` (type: feat, fix, chore, refactor, docs, test, ci)
- **flow:** PR → CI → PL review → squash merge · ห้าม push เข้า main ตรง · **ห้าม `--no-verify`**
- `.standards-version` กับ submodule `standards/` ต้องชี้ tag เดียวกัน (**1.7.0**) · ทีมเลื่อนเองได้เมื่อ `ci.yml` ใช้ `@v1.5.2` ขึ้นไป
- **ตรวจเองก่อนเปิด PR:**
  - `bash standards/scripts/run-all-checks.sh .`
  - `rm -rf frontend/.next && pnpm -r typecheck` (script `typecheck` ของ frontend = `next typegen && tsc --noEmit`)
  - `CONFORMANCE_ACCOUNTS_FILE=… node standards/conformance/run.js` ต้องได้ **0 failed 0 skipped**
- **Definition of Done:**
  - checks ผ่าน · conformance 0/0
  - SSO ใช้ได้กับ server จริงทั้ง 2 ทาง (ปุ่ม login ของระบบ และเมนูในพอร์ทัล)
  - ค้น log แล้วไม่เจอ `eyJ` หรือ `access_token=`
  - ทดสอบครบ 6 role
  - ไม่มี `.env`, `*.pem`, `generated/`, `dist/` ใน git
  - คำสั่งใน README ใช้ได้จริงทุกบรรทัด · มี `REPORT.md` แนบผลรันจริง

## 9. บทเรียนจาก nexus (เจอจริง ต้องระวัง)

- **ใน PowerShell/Git Bash บน Windows:** ไฟล์จำนวนมากเป็น CRLF ถ้าแทนที่ข้อความด้วยสคริปต์ต้องรองรับ `\r\n` · `subsystem.yaml` ต้องเป็น **LF** เพราะ parser ของ conformance อ่าน CRLF ไม่ได้
- **parser ของ `subsystem.yaml`:** ห้ามใช้ string หลายบรรทัดและห้ามใช้ flow mapping · key ถูกแปลงเป็น camelCase
- **Next 16:** ไฟล์ `proxy.ts` ทำงานก่อน rewrites · ถ้ามันดัก `/auth/*` การล็อกอินจะพังทั้งหมด
- **การทดสอบในเบราว์เซอร์ (CDP):** ต้องเริ่มที่ `/auth/login` เพื่อเอาคุกกี้ state ก่อน แล้วค่อยเรียก handoff ด้วย state เดียวกัน
- **ล็อกอินไม่ได้ทั้งที่โค้ดถูก:** มักเป็นเพราะเปิดเว็บด้วย `127.0.0.1` แต่ลงทะเบียนเป็น `localhost` (คุกกี้แยกตาม host) หรือเพราะ Core Hub ที่ใช้ไม่มี `/sso/authorize`
- **WebRTC:** ICE candidate อาจมาถึงก่อน answer ต้องเก็บใส่บัฟเฟอร์ก่อน
- **process ที่ Claude รันเบื้องหลังด้วย Bash ถูกปิดเมื่อครบเวลา:** server ที่ต้องรันค้างให้เปิดด้วย PowerShell `Start-Process`
- **ห้ามใช้ข้อมูลปลอม (mock) และห้ามมีปุ่มที่กดแล้วไม่ทำอะไร** · ทุกอย่างต้องฟรี · ห้ามเรียก API ภายนอกที่ต้องใช้ key หรือส่งข้อมูลผู้ใช้ออกไปนอกระบบ (ถ้าจำเป็นต้องขอข้อยกเว้นก่อน)
